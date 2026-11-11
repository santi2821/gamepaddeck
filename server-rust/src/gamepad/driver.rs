//! Gamepad driver abstraction for virtual and fallback controller emulation.

use crate::protocol::PadSlot;

pub trait GamepadDriver: Send + Sync {
    /// Human readable name of the active driver.
    fn driver_name(&self) -> &'static str;

    /// True if backed by a physical/kernel OS virtual controller (e.g. ViGEmBus).
    fn is_hardware_emulated(&self) -> bool;

    /// Connects/plugs-in the virtual gamepad for the specified slot.
    fn connect_slot(&mut self, slot_idx: usize) -> Result<(), String>;

    /// Disconnects/unplugs the virtual gamepad for the specified slot.
    fn disconnect_slot(&mut self, slot_idx: usize) -> Result<(), String>;

    /// Submits state update to the controller.
    fn update_slot(&mut self, slot_idx: usize, slot: &PadSlot) -> Result<(), String>;
}
