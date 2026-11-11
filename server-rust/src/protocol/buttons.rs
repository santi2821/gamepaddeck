//! Button bitmasks matching XInput / LithiumPad specification.

pub const BTN_DPAD_UP: u16 = 1 << 0;     // 0x0001
pub const BTN_DPAD_DOWN: u16 = 1 << 1;   // 0x0002
pub const BTN_DPAD_LEFT: u16 = 1 << 2;   // 0x0004
pub const BTN_DPAD_RIGHT: u16 = 1 << 3;  // 0x0008
pub const BTN_START: u16 = 1 << 4;       // 0x0010
pub const BTN_BACK: u16 = 1 << 5;        // 0x0020
pub const BTN_THUMB_L: u16 = 1 << 6;     // 0x0040
pub const BTN_THUMB_R: u16 = 1 << 7;     // 0x0080
pub const BTN_SHOULDER_L: u16 = 1 << 8;  // 0x0100
pub const BTN_SHOULDER_R: u16 = 1 << 9;  // 0x0200
pub const BTN_GUIDE: u16 = 1 << 10;      // 0x0400
pub const BTN_A: u16 = 1 << 12;          // 0x1000
pub const BTN_B: u16 = 1 << 13;          // 0x2000
pub const BTN_X: u16 = 1 << 14;          // 0x4000
pub const BTN_Y: u16 = 1 << 15;          // 0x8000

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
pub struct ButtonState {
    pub dpad_up: bool,
    pub dpad_down: bool,
    pub dpad_left: bool,
    pub dpad_right: bool,
    pub start: bool,
    pub back: bool,
    pub thumb_l: bool,
    pub thumb_r: bool,
    pub shoulder_l: bool,
    pub shoulder_r: bool,
    pub guide: bool,
    pub a: bool,
    pub b: bool,
    pub x: bool,
    pub y: bool,
}

impl ButtonState {
    #[inline(always)]
    pub fn from_raw(raw: u16) -> Self {
        Self {
            dpad_up: (raw & BTN_DPAD_UP) != 0,
            dpad_down: (raw & BTN_DPAD_DOWN) != 0,
            dpad_left: (raw & BTN_DPAD_LEFT) != 0,
            dpad_right: (raw & BTN_DPAD_RIGHT) != 0,
            start: (raw & BTN_START) != 0,
            back: (raw & BTN_BACK) != 0,
            thumb_l: (raw & BTN_THUMB_L) != 0,
            thumb_r: (raw & BTN_THUMB_R) != 0,
            shoulder_l: (raw & BTN_SHOULDER_L) != 0,
            shoulder_r: (raw & BTN_SHOULDER_R) != 0,
            guide: (raw & BTN_GUIDE) != 0,
            a: (raw & BTN_A) != 0,
            b: (raw & BTN_B) != 0,
            x: (raw & BTN_X) != 0,
            y: (raw & BTN_Y) != 0,
        }
    }

    #[inline(always)]
    pub fn to_raw(&self) -> u16 {
        let mut raw = 0u16;
        if self.dpad_up { raw |= BTN_DPAD_UP; }
        if self.dpad_down { raw |= BTN_DPAD_DOWN; }
        if self.dpad_left { raw |= BTN_DPAD_LEFT; }
        if self.dpad_right { raw |= BTN_DPAD_RIGHT; }
        if self.start { raw |= BTN_START; }
        if self.back { raw |= BTN_BACK; }
        if self.thumb_l { raw |= BTN_THUMB_L; }
        if self.thumb_r { raw |= BTN_THUMB_R; }
        if self.shoulder_l { raw |= BTN_SHOULDER_L; }
        if self.shoulder_r { raw |= BTN_SHOULDER_R; }
        if self.guide { raw |= BTN_GUIDE; }
        if self.a { raw |= BTN_A; }
        if self.b { raw |= BTN_B; }
        if self.x { raw |= BTN_X; }
        if self.y { raw |= BTN_Y; }
        raw
    }
}
