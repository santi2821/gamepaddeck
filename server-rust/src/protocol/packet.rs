//! LithiumPad 36-byte network packet and slot serialization/deserialization.

use super::buttons::ButtonState;

pub const MAGIC: u8 = 0xAA;
pub const PACKET_LEN: usize = 36;
pub const SLOT_LEN: usize = 8;
pub const NUM_SLOTS: usize = 4;
pub const SINGLE_SLOT_BIN_LEN: usize = 9; // [slot_id, buttons_lo, buttons_hi, l2, r2, lx, ly, rx, ry]

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ProtocolError {
    #[error("Invalid packet length: got {0}, expected {PACKET_LEN}")]
    InvalidLength(usize),
    #[error("Invalid magic byte: {0:#04X}, expected {MAGIC:#04X}")]
    InvalidMagic(u8),
    #[error("Invalid slot index: {0}, must be 0..3")]
    InvalidSlotIndex(usize),
}

/// Representation of a single controller's input state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
pub struct PadSlot {
    pub buttons: u16,
    pub l2: u8,
    pub r2: u8,
    pub lx: i8,
    pub ly: i8,
    pub rx: i8,
    pub ry: i8,
}

impl PadSlot {
    #[inline(always)]
    pub fn new(buttons: u16, l2: u8, r2: u8, lx: i8, ly: i8, rx: i8, ry: i8) -> Self {
        Self { buttons, l2, r2, lx, ly, rx, ry }
    }

    /// Deserializes 8 bytes into a PadSlot.
    #[inline(always)]
    pub fn deserialize(buf: &[u8]) -> Self {
        debug_assert!(buf.len() >= SLOT_LEN);
        let buttons = u16::from_le_bytes([buf[0], buf[1]]);
        let l2 = buf[2];
        let r2 = buf[3];
        let lx = buf[4] as i8;
        let ly = buf[5] as i8;
        let rx = buf[6] as i8;
        let ry = buf[7] as i8;
        Self { buttons, l2, r2, lx, ly, rx, ry }
    }

    /// Serializes PadSlot into 8 bytes.
    #[inline(always)]
    pub fn serialize(&self, out: &mut [u8; SLOT_LEN]) {
        let b = self.buttons.to_le_bytes();
        out[0] = b[0];
        out[1] = b[1];
        out[2] = self.l2;
        out[3] = self.r2;
        out[4] = self.lx as u8;
        out[5] = self.ly as u8;
        out[6] = self.rx as u8;
        out[7] = self.ry as u8;
    }

    /// Normalized float value for LX stick (-1.0 to 1.0).
    #[inline(always)]
    pub fn lx_normalized(&self) -> f32 {
        if self.lx < 0 { self.lx as f32 / 128.0 } else { self.lx as f32 / 127.0 }
    }

    /// Normalized float value for LY stick (-1.0 to 1.0).
    #[inline(always)]
    pub fn ly_normalized(&self) -> f32 {
        if self.ly < 0 { self.ly as f32 / 128.0 } else { self.ly as f32 / 127.0 }
    }

    /// Normalized float value for RX stick (-1.0 to 1.0).
    #[inline(always)]
    pub fn rx_normalized(&self) -> f32 {
        if self.rx < 0 { self.rx as f32 / 128.0 } else { self.rx as f32 / 127.0 }
    }

    /// Normalized float value for RY stick (-1.0 to 1.0).
    #[inline(always)]
    pub fn ry_normalized(&self) -> f32 {
        if self.ry < 0 { self.ry as f32 / 128.0 } else { self.ry as f32 / 127.0 }
    }

    /// Normalized float value for L2 trigger (0.0 to 1.0).
    #[inline(always)]
    pub fn l2_normalized(&self) -> f32 {
        self.l2 as f32 / 255.0
    }

    /// Normalized float value for R2 trigger (0.0 to 1.0).
    #[inline(always)]
    pub fn r2_normalized(&self) -> f32 {
        self.r2 as f32 / 255.0
    }

    /// Returns detailed button breakdown.
    #[inline(always)]
    pub fn button_state(&self) -> ButtonState {
        ButtonState::from_raw(self.buttons)
    }
}

/// Full 36-byte network packet containing header and up to 4 gamepad slots.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Packet {
    pub seq: u8,
    pub active_mask: u8,
    pub flags: u8,
    pub slots: [PadSlot; NUM_SLOTS],
}

impl Default for Packet {
    fn default() -> Self {
        Self {
            seq: 0,
            active_mask: 0,
            flags: 0,
            slots: [PadSlot::default(); NUM_SLOTS],
        }
    }
}

impl Packet {
    pub fn new(seq: u8, active_mask: u8, flags: u8) -> Self {
        Self {
            seq,
            active_mask,
            flags,
            slots: [PadSlot::default(); NUM_SLOTS],
        }
    }

    /// Checks if a specific slot (0..3) is marked active in active_mask.
    #[inline(always)]
    pub fn is_slot_active(&self, slot: usize) -> bool {
        if slot < NUM_SLOTS {
            (self.active_mask & (1 << slot)) != 0
        } else {
            false
        }
    }

    /// Sets or clears slot active bit.
    #[inline(always)]
    pub fn set_slot_active(&mut self, slot: usize, active: bool) {
        if slot < NUM_SLOTS {
            if active {
                self.active_mask |= 1 << slot;
            } else {
                self.active_mask &= !(1 << slot);
            }
        }
    }

    /// Ultra-fast zero-allocation parser for 36-byte packet.
    #[inline(always)]
    pub fn parse(buf: &[u8]) -> Result<Self, ProtocolError> {
        if buf.len() != PACKET_LEN {
            return Err(ProtocolError::InvalidLength(buf.len()));
        }
        if buf[0] != MAGIC {
            return Err(ProtocolError::InvalidMagic(buf[0]));
        }

        let seq = buf[1];
        let active_mask = buf[2];
        let flags = buf[3];

        let slot0 = PadSlot::deserialize(&buf[4..12]);
        let slot1 = PadSlot::deserialize(&buf[12..20]);
        let slot2 = PadSlot::deserialize(&buf[20..28]);
        let slot3 = PadSlot::deserialize(&buf[28..36]);

        Ok(Self {
            seq,
            active_mask,
            flags,
            slots: [slot0, slot1, slot2, slot3],
        })
    }

    /// Serializes this packet directly into a 36-byte buffer with zero heap allocations.
    #[inline(always)]
    pub fn serialize(&self, out: &mut [u8; PACKET_LEN]) {
        out[0] = MAGIC;
        out[1] = self.seq;
        out[2] = self.active_mask;
        out[3] = self.flags;

        let mut slot_buf = [0u8; SLOT_LEN];
        for i in 0..NUM_SLOTS {
            self.slots[i].serialize(&mut slot_buf);
            let offset = 4 + i * SLOT_LEN;
            out[offset..offset + SLOT_LEN].copy_from_slice(&slot_buf);
        }
    }

    /// Serializes to a byte array.
    #[inline(always)]
    pub fn to_bytes(&self) -> [u8; PACKET_LEN] {
        let mut out = [0u8; PACKET_LEN];
        self.serialize(&mut out);
        out
    }
}
