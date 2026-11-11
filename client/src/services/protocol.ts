import {
  GamepadButtons,
  type NormalizedGamepadState,
  type PadReport,
} from '../types/gamepad';

export const PROTOCOL_MAGIC = 0xaa;
export const PACKET_SIZE_36 = 36;

export function createEmptyPadReport(): PadReport {
  return {
    buttons: 0,
    l2: 0,
    r2: 0,
    lx: 0,
    ly: 0,
    rx: 0,
    ry: 0,
  };
}

export function createEmptyNormalizedState(): NormalizedGamepadState {
  return {
    a: false,
    b: false,
    x: false,
    y: false,
    dpadUp: false,
    dpadDown: false,
    dpadLeft: false,
    dpadRight: false,
    lb: false,
    rb: false,
    lt: 0,
    rt: 0,
    back: false,
    start: false,
    guide: false,
    ls: false,
    rs: false,
    lx: 0,
    ly: 0,
    rx: 0,
    ry: 0,
  };
}

/**
 * Clamp a number between min and max
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Convert float (-1.0 to 1.0) to signed int8 (-128 to 127)
 */
export function floatToInt8(val: number): number {
  const clamped = clamp(val, -1.0, 1.0);
  if (clamped < 0) {
    return Math.round(clamped * 128);
  }
  return Math.round(clamped * 127);
}

/**
 * Convert float (0.0 to 1.0) to unsigned uint8 (0 to 255)
 */
export function floatToUint8(val: number): number {
  const clamped = clamp(val, 0.0, 1.0);
  return Math.round(clamped * 255);
}

/**
 * Convert signed int8 (-128 to 127) to float (-1.0 to 1.0)
 */
export function int8ToFloat(val: number): number {
  if (val < 0) {
    return clamp(val / 128.0, -1.0, 1.0);
  }
  return clamp(val / 127.0, -1.0, 1.0);
}

/**
 * Convert unsigned uint8 (0 to 255) to float (0.0 to 1.0)
 */
export function uint8ToFloat(val: number): number {
  return clamp(val / 255.0, 0.0, 1.0);
}

/**
 * Apply circular deadzone with smooth rescaling
 */
export function applyDeadzone(
  x: number,
  y: number,
  deadzone: number = 0.12
): { x: number; y: number; magnitude: number } {
  const mag = Math.hypot(x, y);
  if (mag <= deadzone) {
    return { x: 0, y: 0, magnitude: 0 };
  }

  // Smooth scaling from deadzone threshold to outer rim (1.0)
  const clampedMag = Math.min(1.0, mag);
  const normalizedMag = (clampedMag - deadzone) / (1.0 - deadzone);
  const scale = normalizedMag / mag;

  return {
    x: clamp(x * scale, -1.0, 1.0),
    y: clamp(y * scale, -1.0, 1.0),
    magnitude: normalizedMag,
  };
}

/**
 * Convert UI normalized state into the 8-byte PadReport
 */
export function normalizedToPadReport(
  state: NormalizedGamepadState,
  invertY: boolean = false
): PadReport {
  let buttons = 0;

  if (state.dpadUp) buttons |= GamepadButtons.DPAD_UP;
  if (state.dpadDown) buttons |= GamepadButtons.DPAD_DOWN;
  if (state.dpadLeft) buttons |= GamepadButtons.DPAD_LEFT;
  if (state.dpadRight) buttons |= GamepadButtons.DPAD_RIGHT;
  if (state.start) buttons |= GamepadButtons.START;
  if (state.back) buttons |= GamepadButtons.BACK;
  if (state.ls) buttons |= GamepadButtons.LS;
  if (state.rs) buttons |= GamepadButtons.RS;
  if (state.lb) buttons |= GamepadButtons.LB;
  if (state.rb) buttons |= GamepadButtons.RB;
  if (state.guide) buttons |= GamepadButtons.GUIDE;
  if (state.a) buttons |= GamepadButtons.A;
  if (state.b) buttons |= GamepadButtons.B;
  if (state.x) buttons |= GamepadButtons.X;
  if (state.y) buttons |= GamepadButtons.Y;

  const lyMultiplier = invertY ? -1 : 1;
  const ryMultiplier = invertY ? -1 : 1;

  return {
    buttons: buttons & 0xffff,
    l2: floatToUint8(state.lt),
    r2: floatToUint8(state.rt),
    lx: floatToInt8(state.lx),
    ly: floatToInt8(state.ly * lyMultiplier),
    rx: floatToInt8(state.rx),
    ry: floatToInt8(state.ry * ryMultiplier),
  };
}

/**
 * Convert 8-byte PadReport into NormalizedGamepadState
 */
export function padReportToNormalized(report: PadReport): NormalizedGamepadState {
  const b = report.buttons;
  return {
    dpadUp: (b & GamepadButtons.DPAD_UP) !== 0,
    dpadDown: (b & GamepadButtons.DPAD_DOWN) !== 0,
    dpadLeft: (b & GamepadButtons.DPAD_LEFT) !== 0,
    dpadRight: (b & GamepadButtons.DPAD_RIGHT) !== 0,
    start: (b & GamepadButtons.START) !== 0,
    back: (b & GamepadButtons.BACK) !== 0,
    ls: (b & GamepadButtons.LS) !== 0,
    rs: (b & GamepadButtons.RS) !== 0,
    lb: (b & GamepadButtons.LB) !== 0,
    rb: (b & GamepadButtons.RB) !== 0,
    guide: (b & GamepadButtons.GUIDE) !== 0,
    a: (b & GamepadButtons.A) !== 0,
    b: (b & GamepadButtons.B) !== 0,
    x: (b & GamepadButtons.X) !== 0,
    y: (b & GamepadButtons.Y) !== 0,
    lt: uint8ToFloat(report.l2),
    rt: uint8ToFloat(report.r2),
    lx: int8ToFloat(report.lx),
    ly: int8ToFloat(report.ly),
    rx: int8ToFloat(report.rx),
    ry: int8ToFloat(report.ry),
  };
}

/**
 * Builds standard 36-byte JoyBus / LithiumPad UDP/TCP packet
 * Header (4 bytes): [0xAA, sequence, activeSlotsMask, flags]
 * 4 Slots of 8 bytes: [btn_lo, btn_hi, l2, r2, lx, ly, rx, ry]
 */
export function build36BytePacket(
  activeSlot: number,
  report: PadReport,
  seq: number = 0,
  otherSlots?: (PadReport | null)[]
): Uint8Array {
  const buffer = new Uint8Array(PACKET_SIZE_36);
  const view = new DataView(buffer.buffer);

  // Header
  buffer[0] = PROTOCOL_MAGIC;
  buffer[1] = seq & 0xff;

  let activeMask = 1 << (activeSlot & 0x03);
  if (otherSlots) {
    for (let i = 0; i < 4; i++) {
      if (otherSlots[i]) activeMask |= 1 << i;
    }
  }
  buffer[2] = activeMask & 0xff;
  buffer[3] = 0x00; // flags / reserved

  // Write all slots
  for (let s = 0; s < 4; s++) {
    const base = 4 + s * 8;
    const r = s === activeSlot ? report : otherSlots?.[s] || null;

    if (r) {
      view.setUint16(base, r.buttons & 0xffff, true); // Little endian
      buffer[base + 2] = r.l2 & 0xff;
      buffer[base + 3] = r.r2 & 0xff;
      view.setInt8(base + 4, r.lx);
      view.setInt8(base + 5, r.ly);
      view.setInt8(base + 6, r.rx);
      view.setInt8(base + 7, r.ry);
    } else {
      // Empty slot centered
      view.setUint16(base, 0, true);
      buffer[base + 2] = 0;
      buffer[base + 3] = 0;
      view.setInt8(base + 4, 0);
      view.setInt8(base + 5, 0);
      view.setInt8(base + 6, 0);
      view.setInt8(base + 7, 0);
    }
  }

  return buffer;
}

/**
 * Parses a 36-byte packet into structured data
 */
export function parse36BytePacket(buffer: Uint8Array): {
  valid: boolean;
  seq: number;
  activeMask: number;
  slots: PadReport[];
} {
  if (buffer.length < PACKET_SIZE_36 || buffer[0] !== PROTOCOL_MAGIC) {
    return {
      valid: false,
      seq: 0,
      activeMask: 0,
      slots: [createEmptyPadReport(), createEmptyPadReport(), createEmptyPadReport(), createEmptyPadReport()],
    };
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const seq = buffer[1];
  const activeMask = buffer[2];
  const slots: PadReport[] = [];

  for (let s = 0; s < 4; s++) {
    const base = 4 + s * 8;
    slots.push({
      buttons: view.getUint16(base, true),
      l2: buffer[base + 2],
      r2: buffer[base + 3],
      lx: view.getInt8(base + 4),
      ly: view.getInt8(base + 5),
      rx: view.getInt8(base + 6),
      ry: view.getInt8(base + 7),
    });
  }

  return { valid: true, seq, activeMask, slots };
}

/**
 * Ultra-compact 12-byte single-slot WebSocket binary packet:
 * [0xAA, seq, slot, flags, buttons_lo, buttons_hi, l2, r2, lx, ly, rx, ry]
 */
export function buildCompactSlotPacket(
  slot: number,
  report: PadReport,
  seq: number = 0
): Uint8Array {
  const buf = new Uint8Array(12);
  const view = new DataView(buf.buffer);

  buf[0] = PROTOCOL_MAGIC;
  buf[1] = seq & 0xff;
  buf[2] = slot & 0x03;
  buf[3] = 0x01; // single slot flag
  view.setUint16(4, report.buttons & 0xffff, true);
  buf[6] = report.l2 & 0xff;
  buf[7] = report.r2 & 0xff;
  view.setInt8(8, report.lx);
  view.setInt8(9, report.ly);
  view.setInt8(10, report.rx);
  view.setInt8(11, report.ry);

  return buf;
}

/**
 * Builds a JSON report message
 */
export function buildJsonReport(
  slot: number,
  report: PadReport,
  timestamp: number = performance.now()
): string {
  return JSON.stringify({
    type: 'input',
    slot,
    buttons: report.buttons,
    l2: report.l2,
    r2: report.r2,
    lx: report.lx,
    ly: report.ly,
    rx: report.rx,
    ry: report.ry,
    timestamp: Math.round(timestamp),
  });
}
