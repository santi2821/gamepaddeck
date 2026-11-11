//! ViGEmBus driver implementation for native Windows Xbox 360 virtual gamepad emulation.

use super::driver::GamepadDriver;
use crate::protocol::{PadSlot, NUM_SLOTS};
use std::sync::Arc;

#[inline(always)]
pub fn scale_stick_axis(val: i8, invert: bool) -> i16 {
    let scaled = if val < 0 {
        ((val as i32) * 32768) / 128
    } else {
        ((val as i32) * 32767) / 127
    };
    let res = if invert { -scaled } else { scaled };
    res.clamp(i16::MIN as i32, i16::MAX as i32) as i16
}

#[cfg(windows)]
pub struct ViGEmDriver {
    client: Arc<vigem_client::Client>,
    targets: [Option<vigem_client::Xbox360Wired<Arc<vigem_client::Client>>>; NUM_SLOTS],
}

#[cfg(windows)]
impl ViGEmDriver {
    pub fn new() -> Result<Self, String> {
        let client = vigem_client::Client::connect()
            .map_err(|e| format!("Failed to connect to ViGEmBus driver: {:?}", e))?;
        tracing::info!("ViGEmBus driver connected successfully!");
        Ok(Self {
            client: Arc::new(client),
            targets: [None, None, None, None],
        })
    }
}

#[cfg(windows)]
impl GamepadDriver for ViGEmDriver {
    fn driver_name(&self) -> &'static str {
        "ViGEmBus (Virtual Xbox 360 Controller)"
    }

    fn is_hardware_emulated(&self) -> bool {
        true
    }

    fn connect_slot(&mut self, slot_idx: usize) -> Result<(), String> {
        if slot_idx >= NUM_SLOTS {
            return Err(format!("Invalid slot index: {}", slot_idx));
        }

        if self.targets[slot_idx].is_some() {
            return Ok(());
        }

        tracing::info!(slot = slot_idx, "Plugging in virtual Xbox 360 controller...");
        let mut target = vigem_client::Xbox360Wired::new(self.client.clone(), vigem_client::TargetId::XBOX360_WIRED);
        target.plugin().map_err(|e| format!("Plugin failed for slot {}: {:?}", slot_idx, e))?;
        let _ = target.wait_ready();
        self.targets[slot_idx] = Some(target);
        tracing::info!(slot = slot_idx, "Virtual Xbox 360 controller ready!");
        Ok(())
    }

    fn disconnect_slot(&mut self, slot_idx: usize) -> Result<(), String> {
        if slot_idx >= NUM_SLOTS {
            return Err(format!("Invalid slot index: {}", slot_idx));
        }

        if let Some(mut target) = self.targets[slot_idx].take() {
            tracing::info!(slot = slot_idx, "Unplugging virtual Xbox 360 controller...");
            let _ = target.unplug();
        }
        Ok(())
    }

    fn update_slot(&mut self, slot_idx: usize, slot: &PadSlot) -> Result<(), String> {
        if slot_idx >= NUM_SLOTS {
            return Err(format!("Invalid slot index: {}", slot_idx));
        }

        if self.targets[slot_idx].is_none() {
            self.connect_slot(slot_idx)?;
        }

        if let Some(target) = &mut self.targets[slot_idx] {
            let gamepad = vigem_client::XGamepad {
                buttons: vigem_client::XButtons { raw: slot.buttons },
                left_trigger: slot.l2,
                right_trigger: slot.r2,
                thumb_lx: scale_stick_axis(slot.lx, false),
                thumb_ly: scale_stick_axis(slot.ly, true),
                thumb_rx: scale_stick_axis(slot.rx, false),
                thumb_ry: scale_stick_axis(slot.ry, true),
            };
            target.update(&gamepad).map_err(|e| format!("Update failed on slot {}: {:?}", slot_idx, e))?;
        }
        Ok(())
    }
}

#[cfg(not(windows))]
pub struct ViGEmDriver;

#[cfg(not(windows))]
impl ViGEmDriver {
    pub fn new() -> Result<Self, String> {
        Err("ViGEmBus is only supported on Windows".to_string())
    }
}

#[cfg(not(windows))]
impl GamepadDriver for ViGEmDriver {
    fn driver_name(&self) -> &'static str {
        "ViGEmBus (Unavailable on non-Windows)"
    }
    fn is_hardware_emulated(&self) -> bool { false }
    fn connect_slot(&mut self, _: usize) -> Result<(), String> { Err("Not on Windows".to_string()) }
    fn disconnect_slot(&mut self, _: usize) -> Result<(), String> { Err("Not on Windows".to_string()) }
    fn update_slot(&mut self, _: usize, _: &PadSlot) -> Result<(), String> { Err("Not on Windows".to_string()) }
}
