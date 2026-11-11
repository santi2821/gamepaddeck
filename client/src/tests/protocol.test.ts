import { describe, it, expect } from 'vitest';
import { GamepadButtons } from '../types/gamepad';
import {
  build36BytePacket,
  parse36BytePacket,
  buildCompactSlotPacket,
  floatToInt8,
  int8ToFloat,
  floatToUint8,
  uint8ToFloat,
  createEmptyNormalizedState,
  normalizedToPadReport,
  padReportToNormalized,
  PROTOCOL_MAGIC,
  PACKET_SIZE_36,
} from '../services/protocol';

describe('Gamepad Protocol Serializer & Deserializer', () => {
  it('correctly maps button bitmasks to XInput standard', () => {
    expect(GamepadButtons.DPAD_UP).toBe(0x0001);
    expect(GamepadButtons.DPAD_DOWN).toBe(0x0002);
    expect(GamepadButtons.DPAD_LEFT).toBe(0x0004);
    expect(GamepadButtons.DPAD_RIGHT).toBe(0x0008);
    expect(GamepadButtons.START).toBe(0x0010);
    expect(GamepadButtons.BACK).toBe(0x0020);
    expect(GamepadButtons.LS).toBe(0x0040);
    expect(GamepadButtons.RS).toBe(0x0080);
    expect(GamepadButtons.LB).toBe(0x0100);
    expect(GamepadButtons.RB).toBe(0x0200);
    expect(GamepadButtons.GUIDE).toBe(0x0400);
    expect(GamepadButtons.A).toBe(0x1000);
    expect(GamepadButtons.B).toBe(0x2000);
    expect(GamepadButtons.X).toBe(0x4000);
    expect(GamepadButtons.Y).toBe(0x8000);
  });

  it('converts float to signed int8 and back accurately', () => {
    expect(floatToInt8(0.0)).toBe(0);
    expect(floatToInt8(1.0)).toBe(127);
    expect(floatToInt8(-1.0)).toBe(-128);
    expect(floatToInt8(0.5)).toBe(64);
    expect(floatToInt8(-0.5)).toBe(-64);

    expect(int8ToFloat(0)).toBe(0);
    expect(int8ToFloat(127)).toBe(1);
    expect(int8ToFloat(-128)).toBe(-1);
  });

  it('converts triggers to uint8 and back', () => {
    expect(floatToUint8(0.0)).toBe(0);
    expect(floatToUint8(1.0)).toBe(255);
    expect(floatToUint8(0.5)).toBe(128);

    expect(uint8ToFloat(0)).toBe(0);
    expect(uint8ToFloat(255)).toBe(1);
  });

  it('builds a valid 36-byte packet with 0xAA magic and slot offset', () => {
    const report = {
      buttons: GamepadButtons.A | GamepadButtons.DPAD_UP | GamepadButtons.RB,
      l2: 255,
      r2: 128,
      lx: -128,
      ly: 127,
      rx: 64,
      ry: -64,
    };

    const packet = build36BytePacket(0, report, 42);
    expect(packet.length).toBe(PACKET_SIZE_36);
    expect(packet[0]).toBe(PROTOCOL_MAGIC);
    expect(packet[1]).toBe(42);
    expect(packet[2]).toBe(0x01); // Slot 0 active mask

    // Slot 0 starts at offset 4
    const view = new DataView(packet.buffer);
    expect(view.getUint16(4, true)).toBe(report.buttons);
    expect(packet[6]).toBe(255); // L2
    expect(packet[7]).toBe(128); // R2
    expect(view.getInt8(8)).toBe(-128); // LX
    expect(view.getInt8(9)).toBe(127); // LY
    expect(view.getInt8(10)).toBe(64); // RX
    expect(view.getInt8(11)).toBe(-64); // RY

    // Slot 1 should be empty (offset 12)
    expect(view.getUint16(12, true)).toBe(0);
  });

  it('builds and parses 36-byte packets symmetrically for all 4 slots', () => {
    for (let slot = 0; slot < 4; slot++) {
      const report = {
        buttons: (1 << (slot + 12)) | GamepadButtons.START,
        l2: 50 * slot,
        r2: 60 * slot,
        lx: -100 + slot * 20,
        ly: 80 - slot * 20,
        rx: 30 + slot * 10,
        ry: -40 - slot * 10,
      };

      const packet = build36BytePacket(slot, report, 100 + slot);
      const parsed = parse36BytePacket(packet);

      expect(parsed.valid).toBe(true);
      expect(parsed.seq).toBe(100 + slot);
      expect(parsed.activeMask).toBe(1 << slot);

      const parsedSlot = parsed.slots[slot];
      expect(parsedSlot.buttons).toBe(report.buttons);
      expect(parsedSlot.l2).toBe(report.l2);
      expect(parsedSlot.r2).toBe(report.r2);
      expect(parsedSlot.lx).toBe(report.lx);
      expect(parsedSlot.ly).toBe(report.ly);
      expect(parsedSlot.rx).toBe(report.rx);
      expect(parsedSlot.ry).toBe(report.ry);
    }
  });

  it('supports compact 12-byte packets', () => {
    const report = {
      buttons: GamepadButtons.Y | GamepadButtons.LB,
      l2: 200,
      r2: 100,
      lx: -50,
      ly: 75,
      rx: 0,
      ry: -10,
    };
    const pkt = buildCompactSlotPacket(2, report, 15);
    expect(pkt.length).toBe(12);
    expect(pkt[0]).toBe(PROTOCOL_MAGIC);
    expect(pkt[1]).toBe(15);
    expect(pkt[2]).toBe(2); // slot
  });

  it('transforms NormalizedGamepadState to PadReport and back with fidelity', () => {
    const state = createEmptyNormalizedState();
    state.a = true;
    state.b = true;
    state.dpadDown = true;
    state.lb = true;
    state.lt = 1.0;
    state.rt = 0.5;
    state.lx = -1.0;
    state.ly = 0.5;

    const report = normalizedToPadReport(state);
    expect((report.buttons & GamepadButtons.A) !== 0).toBe(true);
    expect((report.buttons & GamepadButtons.B) !== 0).toBe(true);
    expect((report.buttons & GamepadButtons.DPAD_DOWN) !== 0).toBe(true);
    expect((report.buttons & GamepadButtons.LB) !== 0).toBe(true);
    expect(report.l2).toBe(255);
    expect(report.r2).toBe(128);
    expect(report.lx).toBe(-128);

    const back = padReportToNormalized(report);
    expect(back.a).toBe(true);
    expect(back.b).toBe(true);
    expect(back.dpadDown).toBe(true);
    expect(back.lb).toBe(true);
    expect(back.lt).toBe(1.0);
    expect(back.lx).toBe(-1.0);
  });
});
