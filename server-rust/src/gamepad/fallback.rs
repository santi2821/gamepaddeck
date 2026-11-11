//! In-memory fallback gamepad driver when kernel-level ViGEmBus driver is absent.

use super::driver::GamepadDriver;
use crate::protocol::{PadSlot, NUM_SLOTS};

pub struct FallbackDriver {
    connected: [bool; NUM_SLOTS],
    states: [PadSlot; NUM_SLOTS],
}

impl FallbackDriver {
    pub fn new() -> Self {
        Self {
            connected: [false; NUM_SLOTS],
            states: [PadSlot::default(); NUM_SLOTS],
        }
    }
}

impl GamepadDriver for FallbackDriver {
    fn driver_name(&self) -> &'static str {
        "Fallback (In-Memory / Web Virtual)"
    }

    fn is_hardware_emulated(&self) -> bool {
        false
    }

    fn connect_slot(&mut self, slot_idx: usize) -> Result<(), String> {
        if slot_idx >= NUM_SLOTS {
            return Err(format!("Invalid slot index: {}", slot_idx));
        }
        self.connected[slot_idx] = true;
        tracing::debug!(slot = slot_idx, "Fallback driver: slot connected");
        Ok(())
    }

    fn disconnect_slot(&mut self, slot_idx: usize) -> Result<(), String> {
        if slot_idx >= NUM_SLOTS {
            return Err(format!("Invalid slot index: {}", slot_idx));
        }
        self.connected[slot_idx] = false;
        self.states[slot_idx] = PadSlot::default();
        tracing::debug!(slot = slot_idx, "Fallback driver: slot disconnected");
        Ok(())
    }

    fn update_slot(&mut self, slot_idx: usize, slot: &PadSlot) -> Result<(), String> {
        if slot_idx >= NUM_SLOTS {
            return Err(format!("Invalid slot index: {}", slot_idx));
        }
        if !self.connected[slot_idx] {
            self.connected[slot_idx] = true;
        }
        self.states[slot_idx] = *slot;
        Ok(())
    }
}
