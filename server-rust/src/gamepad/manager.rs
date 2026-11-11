//! Multi-slot Gamepad Manager with real-time telemetry and automatic driver fallback.

use super::driver::GamepadDriver;
use super::fallback::FallbackDriver;
use super::vigem::ViGEmDriver;
use crate::protocol::{PadSlot, Packet, NUM_SLOTS};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ControllerMeta {
    pub brand: String,
    pub name: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SlotTelemetry {
    pub slot: usize,
    pub active: bool,
    pub source: Option<String>,
    pub last_seen_ms: u64,
    pub packets_received: u64,
    pub pps: f32,
    pub rtt_ms: f32,
    pub state: PadSlot,
    pub meta: Option<ControllerMeta>,
}

// Remote network sources may take over a slot held by a local browser. Equal
// priority sources never overwrite each other until the owner leaves or times out.
fn source_priority(source: Option<&str>) -> u8 {
    if source.is_some_and(|s| s.starts_with("remote ")) { 2 } else { 1 }
}

fn source_may_update(slot: &SlotStateInternal, source: Option<&str>) -> bool {
    !slot.active || slot.source.as_deref() == source
        || source_priority(source) > source_priority(slot.source.as_deref())
}

struct SlotStateInternal {
    active: bool,
    source: Option<String>,
    meta: Option<ControllerMeta>,
    last_seen: Instant,
    last_seen_epoch_ms: u64,
    total_packets: u64,
    packets_window: u64,
    last_window_time: Instant,
    pps: f32,
    rtt_ms: f32,
    current_state: PadSlot,
}

impl Default for SlotStateInternal {
    fn default() -> Self {
        let now = Instant::now();
        Self {
            active: false,
            source: None,
            meta: None,
            last_seen: now,
            last_seen_epoch_ms: 0,
            total_packets: 0,
            packets_window: 0,
            last_window_time: now,
            pps: 0.0,
            rtt_ms: 0.0,
            current_state: PadSlot::default(),
        }
    }
}

pub struct GamepadManager {
    driver: Box<dyn GamepadDriver>,
    slots: [SlotStateInternal; NUM_SLOTS],
    total_udp_packets: u64,
    total_ws_packets: u64,
    start_time: Instant,
}

impl GamepadManager {
    pub fn new(force_fallback: bool) -> Self {
        let driver: Box<dyn GamepadDriver> = if !force_fallback {
            match ViGEmDriver::new() {
                Ok(v) => {
                    tracing::info!("Using native ViGEmBus driver for controller emulation");
                    Box::new(v)
                }
                Err(err) => {
                    tracing::warn!("ViGEmBus driver not available ({}), using Fallback driver", err);
                    Box::new(FallbackDriver::new())
                }
            }
        } else {
            tracing::info!("Force fallback enabled: using Fallback driver");
            Box::new(FallbackDriver::new())
        };

        Self {
            driver,
            slots: Default::default(),
            total_udp_packets: 0,
            total_ws_packets: 0,
            start_time: Instant::now(),
        }
    }

    pub fn driver_name(&self) -> &'static str {
        self.driver.driver_name()
    }

    pub fn is_hardware_emulated(&self) -> bool {
        self.driver.is_hardware_emulated()
    }

    pub fn uptime_secs(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    pub fn total_packets(&self) -> (u64, u64) {
        (self.total_udp_packets, self.total_ws_packets)
    }

    /// Handles a 36-byte UDP packet. A slot belongs to its source until disconnect or inactivity timeout,
    /// except that a remote source can take over from a local source.
    pub fn handle_packet(&mut self, packet: &Packet, source_info: Option<&str>) {
        self.handle_full_packet(packet, source_info, false);
    }

    /// WebSocket full-size packets use the same wire format as UDP.
    pub fn handle_ws_packet(&mut self, packet: &Packet, source_info: Option<&str>) {
        self.handle_full_packet(packet, source_info, true);
    }

    fn handle_full_packet(&mut self, packet: &Packet, source_info: Option<&str>, websocket: bool) {
        if websocket {
            self.total_ws_packets = self.total_ws_packets.saturating_add(1);
        } else {
            self.total_udp_packets = self.total_udp_packets.saturating_add(1);
        }
        let now = Instant::now();
        let epoch_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        for i in 0..NUM_SLOTS {
            let slot_active = packet.is_slot_active(i);
            let slot = &mut self.slots[i];

            if slot_active {
                if !source_may_update(slot, source_info) {
                    continue;
                }
                if slot.active && slot.source.as_deref() != source_info {
                    slot.meta = None;
                }
                if !slot.active {
                    if let Err(err) = self.driver.connect_slot(i) {
                        tracing::warn!(slot = i, error = %err, "Failed to connect controller");
                        continue;
                    }
                    slot.active = true;
                }

                slot.last_seen = now;
                slot.last_seen_epoch_ms = epoch_ms;
                slot.total_packets = slot.total_packets.saturating_add(1);
                slot.packets_window = slot.packets_window.saturating_add(1);
                slot.current_state = packet.slots[i];
                if let Some(src) = source_info {
                    slot.source = Some(src.to_string());
                }

                // Update physical/virtual driver
                let _ = self.driver.update_slot(i, &packet.slots[i]);
            }
        }
    }

    /// Handles a direct single-slot input update (e.g. from Web / WebSocket).
    pub fn handle_single_slot(&mut self, slot_idx: usize, pad_state: &PadSlot, source_info: Option<&str>) {
        if slot_idx >= NUM_SLOTS {
            return;
        }

        self.total_ws_packets = self.total_ws_packets.saturating_add(1);
        let now = Instant::now();
        let epoch_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let slot = &mut self.slots[slot_idx];
        if !source_may_update(slot, source_info) {
            return;
        }
        if slot.active && slot.source.as_deref() != source_info {
            slot.meta = None;
        }
        if !slot.active {
            if let Err(err) = self.driver.connect_slot(slot_idx) {
                tracing::warn!(slot = slot_idx, error = %err, "Failed to connect controller");
                return;
            }
            slot.active = true;
        }

        slot.last_seen = now;
        slot.last_seen_epoch_ms = epoch_ms;
        slot.total_packets = slot.total_packets.saturating_add(1);
        slot.packets_window = slot.packets_window.saturating_add(1);
        slot.current_state = *pad_state;
        if let Some(src) = source_info {
            slot.source = Some(src.to_string());
        }

        let _ = self.driver.update_slot(slot_idx, pad_state);
    }

    /// Updates measured Round-Trip-Time (latency in ms) for a slot.
    pub fn update_rtt(&mut self, slot_idx: usize, rtt_ms: f32) {
        if slot_idx < NUM_SLOTS {
            self.slots[slot_idx].rtt_ms = rtt_ms;
        }
    }

    /// Explicitly disconnects a slot.
    pub fn disconnect_slot(&mut self, slot_idx: usize) {
        if slot_idx < NUM_SLOTS {
            self.slots[slot_idx].active = false;
            self.slots[slot_idx].source = None;
            self.slots[slot_idx].pps = 0.0;
            self.slots[slot_idx].rtt_ms = 0.0;
            self.slots[slot_idx].packets_window = 0;
            self.slots[slot_idx].last_window_time = Instant::now();
            self.slots[slot_idx].current_state = PadSlot::default();
            self.slots[slot_idx].meta = None;
            let _ = self.driver.disconnect_slot(slot_idx);
        }
    }

    /// Release a slot only if the requesting connection owns it.
    pub fn release_slot_for_source(&mut self, slot_idx: usize, source: &str) -> bool {
        if slot_idx < NUM_SLOTS && self.slots[slot_idx].active
            && self.slots[slot_idx].source.as_deref() == Some(source) {
            self.disconnect_slot(slot_idx);
            true
        } else {
            false
        }
    }

    /// Release only slots owned by a closed connection.
    pub fn disconnect_source(&mut self, source: &str) {
        for i in 0..NUM_SLOTS {
            if self.slots[i].active && self.slots[i].source.as_deref() == Some(source) {
                self.disconnect_slot(i);
            }
        }
    }

    /// Update metadata only when it belongs to the current input owner.
    pub fn set_controller_meta_for_source(&mut self, slot_idx: usize, source: &str, brand: &str, name: &str) {
        if slot_idx < NUM_SLOTS && self.slots[slot_idx].active
            && self.slots[slot_idx].source.as_deref() == Some(source) {
            self.set_controller_meta(slot_idx, brand, name);
        }
    }

    /// Records which physical controller owns a virtual slot so dashboards can
    /// show the matching art and name.
    pub fn set_controller_meta(&mut self, slot_idx: usize, brand: &str, name: &str) {
        if slot_idx >= NUM_SLOTS {
            return;
        }
        let next_brand = brand.trim().chars().take(32).collect::<String>();
        let next_name = name.trim().chars().take(96).collect::<String>();

        if next_brand.is_empty() && next_name.is_empty() {
            self.slots[slot_idx].meta = None;
        } else {
            self.slots[slot_idx].meta = Some(ControllerMeta {
                brand: next_brand,
                name: next_name,
            });
        }
    }

    /// Periodic tick to calculate PPS and timeout inactive slots.
    pub fn tick_metrics(&mut self, inactivity_timeout_secs: u64) {
        let now = Instant::now();

        for i in 0..NUM_SLOTS {
            let slot = &mut self.slots[i];
            let elapsed = now.duration_since(slot.last_window_time).as_secs_f32();
            if elapsed >= 0.5 {
                slot.pps = (slot.packets_window as f32) / elapsed;
                slot.packets_window = 0;
                slot.last_window_time = now;
            }

            // Auto-timeout if inactive for too long
            if slot.active && inactivity_timeout_secs > 0 {
                if now.duration_since(slot.last_seen).as_secs() > inactivity_timeout_secs {
                    slot.active = false;
                    slot.source = None;
                    slot.meta = None;
                    slot.pps = 0.0;
                    slot.rtt_ms = 0.0;
                    slot.packets_window = 0;
                    slot.last_window_time = now;
                    slot.current_state = PadSlot::default();
                    let _ = self.driver.disconnect_slot(i);
                    tracing::info!(slot = i, "Slot auto-disconnected due to inactivity");
                }
            }
        }
    }

    /// Returns telemetry for a specific slot.
    pub fn get_slot_telemetry(&self, slot_idx: usize) -> Option<SlotTelemetry> {
        if slot_idx < NUM_SLOTS {
            let s = &self.slots[slot_idx];
            Some(SlotTelemetry {
                slot: slot_idx,
                active: s.active,
                source: s.source.clone(),
                last_seen_ms: s.last_seen_epoch_ms,
                packets_received: s.total_packets,
                pps: s.pps,
                rtt_ms: s.rtt_ms,
                state: s.current_state,
                meta: s.meta.clone(),
            })
        } else {
            None
        }
    }

    /// Returns telemetry for all 4 slots.
    pub fn get_all_slots_telemetry(&self) -> Vec<SlotTelemetry> {
        (0..NUM_SLOTS)
            .filter_map(|i| self.get_slot_telemetry(i))
            .collect()
    }
}

#[cfg(test)]
mod ownership_tests {
    use super::*;

    struct FailedDriver;
    impl GamepadDriver for FailedDriver {
        fn driver_name(&self) -> &'static str { "failed" }
        fn is_hardware_emulated(&self) -> bool { true }
        fn connect_slot(&mut self, _: usize) -> Result<(), String> { Err("connect failed".into()) }
        fn disconnect_slot(&mut self, _: usize) -> Result<(), String> { Ok(()) }
        fn update_slot(&mut self, _: usize, _: &PadSlot) -> Result<(), String> { Err("update failed".into()) }
    }

    #[test]
    fn failed_driver_connection_does_not_claim_slot() {
        let mut manager = GamepadManager::new(true);
        manager.driver = Box::new(FailedDriver);
        manager.handle_single_slot(0, &PadSlot::default(), Some("owner"));
        assert!(!manager.get_slot_telemetry(0).unwrap().active);
        let packet = Packet::new(1, 0b0010, 0);
        manager.handle_packet(&packet, Some("owner"));
        assert!(!manager.get_slot_telemetry(1).unwrap().active);
    }

    #[test]
    fn release_clears_latency_and_pending_packet_window() {
        let mut manager = GamepadManager::new(true);
        manager.handle_single_slot(0, &PadSlot::default(), Some("owner"));
        manager.update_rtt(0, 42.0);
        manager.disconnect_source("owner");
        manager.slots[0].last_window_time = Instant::now() - std::time::Duration::from_secs(1);
        manager.tick_metrics(0);
        let telemetry = manager.get_slot_telemetry(0).unwrap();
        assert_eq!(telemetry.rtt_ms, 0.0);
        assert_eq!(telemetry.pps, 0.0);
    }

    #[test]
    fn rival_packets_do_not_extend_owner_timeout() {
        let mut manager = GamepadManager::new(true);
        let held = PadSlot::new(1, 0, 0, 0, 0, 0, 0);
        manager.handle_single_slot(0, &held, Some("remote UDP owner"));
        manager.slots[0].last_seen = Instant::now() - std::time::Duration::from_secs(7);
        manager.handle_single_slot(0, &PadSlot::default(), Some("local WebSocket rival"));
        manager.tick_metrics(5);
        assert!(!manager.get_slot_telemetry(0).unwrap().active);
        manager.handle_single_slot(0, &PadSlot::default(), Some("local WebSocket rival"));
        assert!(manager.get_slot_telemetry(0).unwrap().active);
    }
}
