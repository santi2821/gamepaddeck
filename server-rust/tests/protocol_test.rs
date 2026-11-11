use gamepaddeck_server::protocol::{
    buttons::*,
    packet::{PadSlot, Packet, ProtocolError, MAGIC, PACKET_LEN},
};

#[test]
fn test_packet_exact_length() {
    let pkt = Packet::default();
    let bytes = pkt.to_bytes();
    assert_eq!(bytes.len(), 36);
    assert_eq!(PACKET_LEN, 36);
}

#[test]
fn test_magic_byte_validation() {
    let mut bytes = [0u8; 36];
    bytes[0] = 0xAA; // Valid magic
    assert!(Packet::parse(&bytes).is_ok());

    bytes[0] = 0xAB; // Invalid magic
    assert_eq!(Packet::parse(&bytes), Err(ProtocolError::InvalidMagic(0xAB)));
}

#[test]
fn test_packet_invalid_length() {
    let short = [0xAA; 35];
    assert_eq!(Packet::parse(&short), Err(ProtocolError::InvalidLength(35)));

    let long = [0xAA; 37];
    assert_eq!(Packet::parse(&long), Err(ProtocolError::InvalidLength(37)));
}

#[test]
fn test_packet_roundtrip_all_slots() {
    let mut pkt = Packet::new(42, 0x0F, 0x01); // 4 slots active

    // Slot 0
    pkt.slots[0].buttons = BTN_A | BTN_SHOULDER_R | BTN_DPAD_UP;
    pkt.slots[0].l2 = 255;
    pkt.slots[0].r2 = 128;
    pkt.slots[0].lx = -128;
    pkt.slots[0].ly = 127;
    pkt.slots[0].rx = -50;
    pkt.slots[0].ry = 50;

    // Slot 1
    pkt.slots[1].buttons = BTN_B | BTN_START;
    pkt.slots[1].l2 = 0;
    pkt.slots[1].r2 = 255;
    pkt.slots[1].lx = 0;
    pkt.slots[1].ly = 0;

    // Slot 2
    pkt.slots[2].buttons = BTN_X | BTN_GUIDE;
    pkt.slots[2].lx = 64;
    pkt.slots[2].ly = -64;

    // Slot 3
    pkt.slots[3].buttons = BTN_Y | BTN_BACK | BTN_THUMB_L | BTN_THUMB_R;
    pkt.slots[3].rx = 127;
    pkt.slots[3].ry = -128;

    let serialized = pkt.to_bytes();
    assert_eq!(serialized[0], MAGIC);
    assert_eq!(serialized[1], 42);
    assert_eq!(serialized[2], 0x0F);
    assert_eq!(serialized[3], 0x01);

    let parsed = Packet::parse(&serialized).expect("Deserialization failed");
    assert_eq!(parsed.seq, 42);
    assert_eq!(parsed.active_mask, 0x0F);
    assert_eq!(parsed.flags, 0x01);

    // Verify slot 0
    assert_eq!(parsed.slots[0].buttons, BTN_A | BTN_SHOULDER_R | BTN_DPAD_UP);
    assert_eq!(parsed.slots[0].l2, 255);
    assert_eq!(parsed.slots[0].r2, 128);
    assert_eq!(parsed.slots[0].lx, -128);
    assert_eq!(parsed.slots[0].ly, 127);
    assert_eq!(parsed.slots[0].rx, -50);
    assert_eq!(parsed.slots[0].ry, 50);

    // Verify slot 1
    assert_eq!(parsed.slots[1].buttons, BTN_B | BTN_START);
    assert_eq!(parsed.slots[1].r2, 255);

    // Verify slot 2
    assert_eq!(parsed.slots[2].buttons, BTN_X | BTN_GUIDE);
    assert_eq!(parsed.slots[2].lx, 64);
    assert_eq!(parsed.slots[2].ly, -64);

    // Verify slot 3
    assert_eq!(parsed.slots[3].buttons, BTN_Y | BTN_BACK | BTN_THUMB_L | BTN_THUMB_R);
    assert_eq!(parsed.slots[3].rx, 127);
    assert_eq!(parsed.slots[3].ry, -128);
}

#[test]
fn test_button_state_struct() {
    let raw = BTN_A | BTN_B | BTN_START | BTN_DPAD_LEFT;
    let state = ButtonState::from_raw(raw);
    assert!(state.a);
    assert!(state.b);
    assert!(!state.x);
    assert!(!state.y);
    assert!(state.start);
    assert!(!state.back);
    assert!(state.dpad_left);
    assert!(!state.dpad_right);

    assert_eq!(state.to_raw(), raw);
}

#[test]
fn test_slot_normalization() {
    let slot = PadSlot::new(0, 255, 0, -128, 127, 0, -64);
    assert!((slot.l2_normalized() - 1.0).abs() < 1e-4);
    assert!((slot.r2_normalized() - 0.0).abs() < 1e-4);
    assert!((slot.lx_normalized() - (-1.0)).abs() < 1e-4);
    assert!((slot.ly_normalized() - 1.0).abs() < 1e-4);
    assert!((slot.rx_normalized() - 0.0).abs() < 1e-4);
    assert!((slot.ry_normalized() - (-0.5)).abs() < 0.01);
}

#[test]
fn test_single_slot_binary_payload() {
    let slot = PadSlot::new(BTN_A, 200, 100, -50, 50, -25, 25);
    let mut buf = [0u8; 8];
    slot.serialize(&mut buf);
    assert_eq!(buf.len(), 8);

    let decoded = PadSlot::deserialize(&buf);
    assert_eq!(decoded.buttons, BTN_A);
    assert_eq!(decoded.l2, 200);
    assert_eq!(decoded.r2, 100);
    assert_eq!(decoded.lx, -50);
    assert_eq!(decoded.ly, 50);
    assert_eq!(decoded.rx, -25);
    assert_eq!(decoded.ry, 25);
}
