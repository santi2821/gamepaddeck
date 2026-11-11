use gamepaddeck_server::{
    gamepad::GamepadManager,
    protocol::{buttons::*, PadSlot, Packet},
};

#[test]
fn test_gamepad_manager_lifecycle() {
    let mut mgr = GamepadManager::new(true); // force fallback for test determinism
    assert_eq!(mgr.driver_name(), "Fallback (In-Memory / Web Virtual)");
    assert!(!mgr.is_hardware_emulated());

    let mut pkt = Packet::new(1, 0x01, 0); // Slot 0 active
    pkt.slots[0].buttons = BTN_A | BTN_B;
    pkt.slots[0].l2 = 250;

    mgr.handle_packet(&pkt, Some("127.0.0.1:9876"));

    let t0 = mgr.get_slot_telemetry(0).expect("Slot 0 missing");
    assert!(t0.active);
    assert_eq!(t0.state.buttons, BTN_A | BTN_B);
    assert_eq!(t0.state.l2, 250);
    assert_eq!(t0.packets_received, 1);
    assert_eq!(t0.source.as_deref(), Some("127.0.0.1:9876"));

    let t1 = mgr.get_slot_telemetry(1).expect("Slot 1 missing");
    assert!(!t1.active);
    assert_eq!(t1.packets_received, 0);

    // Update with slot 1 active as well
    let mut pkt2 = Packet::new(2, 0x03, 0); // Slots 0 and 1 active
    pkt2.slots[1].buttons = BTN_X;
    mgr.handle_packet(&pkt2, Some("127.0.0.1:9876"));

    let t1_updated = mgr.get_slot_telemetry(1).unwrap();
    assert!(t1_updated.active);
    assert_eq!(t1_updated.state.buttons, BTN_X);
    assert_eq!(t1_updated.packets_received, 1);

    // Test manual disconnect
    mgr.disconnect_slot(0);
    let t0_after = mgr.get_slot_telemetry(0).unwrap();
    assert!(!t0_after.active);
    assert_eq!(t0_after.state.buttons, 0);
}

#[test]
fn test_gamepad_manager_single_slot() {
    let mut mgr = GamepadManager::new(true);
    let pad = PadSlot::new(BTN_Y | BTN_START, 0, 255, 100, -100, 0, 0);

    mgr.handle_single_slot(2, &pad, Some("WebSocket PWA"));
    let t2 = mgr.get_slot_telemetry(2).expect("Slot 2 missing");
    assert!(t2.active);
    assert_eq!(t2.state.buttons, BTN_Y | BTN_START);
    assert_eq!(t2.state.r2, 255);
    assert_eq!(t2.state.lx, 100);
    assert_eq!(t2.state.ly, -100);
    assert_eq!(t2.source.as_deref(), Some("WebSocket PWA"));

    mgr.update_rtt(2, 4.5);
    let t2_rtt = mgr.get_slot_telemetry(2).unwrap();
    assert_eq!(t2_rtt.rtt_ms, 4.5);
}

#[test]
fn test_stick_axis_scaling() {
    use gamepaddeck_server::gamepad::vigem::scale_stick_axis;

    // Direct (LX): -128 -> -32768, 127 -> 32767, 0 -> 0
    assert_eq!(scale_stick_axis(-128, false), -32768);
    assert_eq!(scale_stick_axis(127, false), 32767);
    assert_eq!(scale_stick_axis(0, false), 0);

    // Inverted (LY): -128 (full up) -> 32767, 127 (full down) -> -32767
    assert_eq!(scale_stick_axis(-128, true), 32767);
    assert_eq!(scale_stick_axis(127, true), -32767);
    assert_eq!(scale_stick_axis(0, true), 0);
}

#[test]
fn remote_source_takes_over_local_without_rival_neutral_or_disconnect() {
    let mut mgr = GamepadManager::new(true);
    let neutral = PadSlot::default();
    let pressed = PadSlot::new(BTN_X, 0, 0, 0, 0, 0, 0);
    mgr.handle_single_slot(0, &neutral, Some("local WebSocket 127.0.0.1:1"));
    mgr.handle_single_slot(0, &pressed, Some("remote UDP phone:1"));
    for _ in 0..100 {
        mgr.handle_single_slot(0, &neutral, Some("local WebSocket 127.0.0.1:1"));
        assert_eq!(mgr.get_slot_telemetry(0).unwrap().state.buttons, BTN_X);
    }
    mgr.disconnect_source("local WebSocket 127.0.0.1:1");
    assert_eq!(mgr.get_slot_telemetry(0).unwrap().state.buttons, BTN_X);
    mgr.disconnect_source("remote UDP phone:1");
    mgr.handle_single_slot(0, &neutral, Some("local WebSocket 127.0.0.1:1"));
    assert!(mgr.get_slot_telemetry(0).unwrap().active);
    assert_eq!(mgr.get_slot_telemetry(0).unwrap().state.buttons, 0);
}

#[test]
fn four_slots_keep_independent_owners_across_release_and_reuse() {
    let mut mgr = GamepadManager::new(true);
    for slot in 0..4 {
        let owner = format!("remote owner {slot}");
        mgr.handle_single_slot(slot, &PadSlot::new(1 << slot, 0, 0, 0, 0, 0, 0), Some(&owner));
    }
    assert_eq!(mgr.get_all_slots_telemetry().iter().filter(|s| s.active).count(), 4);
    assert!(!mgr.release_slot_for_source(2, "remote owner 1"));
    assert!(mgr.release_slot_for_source(2, "remote owner 2"));
    mgr.handle_single_slot(2, &PadSlot::new(BTN_Y, 0, 0, 0, 0, 0, 0), Some("remote replacement"));
    mgr.disconnect_source("remote owner 2");
    for slot in 0..4 {
        let telemetry = mgr.get_slot_telemetry(slot).unwrap();
        assert!(telemetry.active);
        assert_eq!(telemetry.state.buttons, if slot == 2 { BTN_Y } else { 1 << slot });
    }
    assert_eq!(mgr.get_slot_telemetry(2).unwrap().source.as_deref(), Some("remote replacement"));
    assert!(mgr.get_slot_telemetry(4).is_none());
}
