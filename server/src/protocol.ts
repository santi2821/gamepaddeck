/**
 * LithiumPad & GamepadDeck Network Protocol Specification Implementation.
 * 36 bytes packet layout, little-endian, XInput standard bitmask.
 */

export const MAGIC = 0xAA;
export const PACKET_LEN = 36;
export const NUM_SLOTS = 4;
export const SLOT_LEN = 8;

export const BTN_DPAD_UP    = 1 << 0;  // 0x0001
export const BTN_DPAD_DOWN  = 1 << 1;  // 0x0002
export const BTN_DPAD_LEFT  = 1 << 2;  // 0x0004
export const BTN_DPAD_RIGHT = 1 << 3;  // 0x0008
export const BTN_START      = 1 << 4;  // 0x0010
export const BTN_BACK       = 1 << 5;  // 0x0020
export const BTN_THUMB_L    = 1 << 6;  // 0x0040 (LS / L3)
export const BTN_THUMB_R    = 1 << 7;  // 0x0080 (RS / R3)
export const BTN_SHOULDER_L = 1 << 8;  // 0x0100 (LB / L1)
export const BTN_SHOULDER_R = 1 << 9;  // 0x0200 (RB / R1)
export const BTN_GUIDE      = 1 << 10; // 0x0400 (Xbox / Home)
export const BTN_A          = 1 << 12; // 0x1000 (A / Cross)
export const BTN_B          = 1 << 13; // 0x2000 (B / Circle)
export const BTN_X          = 1 << 14; // 0x4000 (X / Square)
export const BTN_Y          = 1 << 15; // 0x8000 (Y / Triangle)

export interface ButtonState {
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
  start: boolean;
  back: boolean;
  thumbL: boolean;
  thumbR: boolean;
  shoulderL: boolean;
  shoulderR: boolean;
  guide: boolean;
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
}

export class PadSlot {
  buttons: number;
  l2: number;
  r2: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;

  constructor(
    buttons = 0,
    l2 = 0,
    r2 = 0,
    lx = 0,
    ly = 0,
    rx = 0,
    ry = 0
  ) {
    this.buttons = buttons & 0xffff;
    this.l2 = l2 & 0xff;
    this.r2 = r2 & 0xff;
    this.lx = lx < -128 ? -128 : lx > 127 ? 127 : lx;
    this.ly = ly < -128 ? -128 : ly > 127 ? 127 : ly;
    this.rx = rx < -128 ? -128 : rx > 127 ? 127 : rx;
    this.ry = ry < -128 ? -128 : ry > 127 ? 127 : ry;
  }

  static deserialize(buf: Uint8Array | Buffer, offset = 0): PadSlot {
    const view = buf instanceof Buffer ? buf : Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    const buttons = view.readUInt16LE(offset);
    const l2 = view.readUInt8(offset + 2);
    const r2 = view.readUInt8(offset + 3);
    const lx = view.readInt8(offset + 4);
    const ly = view.readInt8(offset + 5);
    const rx = view.readInt8(offset + 6);
    const ry = view.readInt8(offset + 7);
    return new PadSlot(buttons, l2, r2, lx, ly, rx, ry);
  }

  serialize(buf?: Buffer, offset = 0): Buffer {
    const out = buf || Buffer.alloc(SLOT_LEN);
    out.writeUInt16LE(this.buttons, offset);
    out.writeUInt8(this.l2, offset + 2);
    out.writeUInt8(this.r2, offset + 3);
    out.writeInt8(this.lx, offset + 4);
    out.writeInt8(this.ly, offset + 5);
    out.writeInt8(this.rx, offset + 6);
    out.writeInt8(this.ry, offset + 7);
    return out;
  }

  getButtonState(): ButtonState {
    const b = this.buttons;
    return {
      dpadUp: (b & BTN_DPAD_UP) !== 0,
      dpadDown: (b & BTN_DPAD_DOWN) !== 0,
      dpadLeft: (b & BTN_DPAD_LEFT) !== 0,
      dpadRight: (b & BTN_DPAD_RIGHT) !== 0,
      start: (b & BTN_START) !== 0,
      back: (b & BTN_BACK) !== 0,
      thumbL: (b & BTN_THUMB_L) !== 0,
      thumbR: (b & BTN_THUMB_R) !== 0,
      shoulderL: (b & BTN_SHOULDER_L) !== 0,
      shoulderR: (b & BTN_SHOULDER_R) !== 0,
      guide: (b & BTN_GUIDE) !== 0,
      a: (b & BTN_A) !== 0,
      b: (b & BTN_B) !== 0,
      x: (b & BTN_X) !== 0,
      y: (b & BTN_Y) !== 0,
    };
  }
}

export class Packet {
  seq: number;
  activeMask: number;
  flags: number;
  slots: PadSlot[];

  constructor(seq = 0, activeMask = 0, flags = 0, slots?: PadSlot[]) {
    this.seq = seq & 0xff;
    this.activeMask = activeMask & 0xff;
    this.flags = flags & 0xff;
    this.slots = slots || [new PadSlot(), new PadSlot(), new PadSlot(), new PadSlot()];
  }

  isSlotActive(index: number): boolean {
    if (index >= 0 && index < NUM_SLOTS) {
      return (this.activeMask & (1 << index)) !== 0;
    }
    return false;
  }

  setSlotActive(index: number, active: boolean) {
    if (index >= 0 && index < NUM_SLOTS) {
      if (active) {
        this.activeMask |= (1 << index);
      } else {
        this.activeMask &= ~(1 << index);
      }
    }
  }

  static parse(buf: Buffer): Packet {
    if (buf.length !== PACKET_LEN) {
      throw new Error(`Invalid packet length: ${buf.length}, expected ${PACKET_LEN}`);
    }
    const magic = buf.readUInt8(0);
    if (magic !== MAGIC) {
      throw new Error(`Invalid magic byte: 0x${magic.toString(16).toUpperCase()}, expected 0xAA`);
    }

    const seq = buf.readUInt8(1);
    const activeMask = buf.readUInt8(2);
    const flags = buf.readUInt8(3);

    const slots: PadSlot[] = [];
    for (let i = 0; i < NUM_SLOTS; i++) {
      slots.push(PadSlot.deserialize(buf, 4 + i * SLOT_LEN));
    }

    return new Packet(seq, activeMask, flags, slots);
  }

  serialize(): Buffer {
    const buf = Buffer.alloc(PACKET_LEN);
    buf.writeUInt8(MAGIC, 0);
    buf.writeUInt8(this.seq, 1);
    buf.writeUInt8(this.activeMask, 2);
    buf.writeUInt8(this.flags, 3);

    for (let i = 0; i < NUM_SLOTS; i++) {
      this.slots[i].serialize(buf, 4 + i * SLOT_LEN);
    }
    return buf;
  }
}
