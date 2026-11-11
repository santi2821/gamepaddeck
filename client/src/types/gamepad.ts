/**
 * GamepadDeck Types & Bitmasks (matching PROTOCOL.md & standard XInput)
 */

export const GamepadButtons = {
  DPAD_UP: 0x0001,
  DPAD_DOWN: 0x0002,
  DPAD_LEFT: 0x0004,
  DPAD_RIGHT: 0x0008,
  START: 0x0010,
  BACK: 0x0020,
  LS: 0x0040,      // Left Thumbstick click
  RS: 0x0080,      // Right Thumbstick click
  LB: 0x0100,      // Left Bumper
  RB: 0x0200,      // Right Bumper
  GUIDE: 0x0400,   // Xbox/Home button
  A: 0x1000,       // Bottom action (Cross on PS)
  B: 0x2000,       // Right action (Circle on PS)
  X: 0x4000,       // Left action (Square on PS)
  Y: 0x8000,       // Top action (Triangle on PS)
} as const;

export type ButtonKey = keyof typeof GamepadButtons;

export const PlayerSlot = {
  P1: 0,
  P2: 1,
  P3: 2,
  P4: 3,
} as const;

export type PlayerSlotType = (typeof PlayerSlot)[keyof typeof PlayerSlot];

export interface PlayerSlotMeta {
  slot: PlayerSlotType;
  name: string;
  color: string;
  glowColor: string;
  accentBg: string;
}

export const PLAYER_SLOTS: Record<PlayerSlotType, PlayerSlotMeta> = {
  0: {
    slot: 0,
    name: 'Player 1',
    color: '#56b8f5',
    glowColor: 'rgba(86, 184, 245, 0.45)',
    accentBg: 'rgba(86, 184, 245, 0.14)',
  },
  1: {
    slot: 1,
    name: 'Player 2',
    color: '#f2616a',
    glowColor: 'rgba(242, 97, 106, 0.45)',
    accentBg: 'rgba(242, 97, 106, 0.14)',
  },
  2: {
    slot: 2,
    name: 'Player 3',
    color: '#46d08f',
    glowColor: 'rgba(70, 208, 143, 0.45)',
    accentBg: 'rgba(70, 208, 143, 0.14)',
  },
  3: {
    slot: 3,
    name: 'Player 4',
    color: '#fb923c',
    glowColor: 'rgba(251, 146, 60, 0.45)',
    accentBg: 'rgba(251, 146, 60, 0.14)',
  },
};

/**
 * Exact 8-byte report per controller slot in the network packet
 */
export interface PadReport {
  buttons: number; // uint16 bitmask
  l2: number;      // uint8 0..255
  r2: number;      // uint8 0..255
  lx: number;      // int8 -128..127 (negative = left)
  ly: number;      // int8 -128..127 (negative = up)
  rx: number;      // int8 -128..127 (negative = left)
  ry: number;      // int8 -128..127 (negative = up)
}

/**
 * Normalized state for UI rendering and touch handling
 */
export interface NormalizedGamepadState {
  // Action buttons
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
  // D-Pad
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
  // Bumpers & Triggers
  lb: boolean;
  rb: boolean;
  lt: number; // 0.0 .. 1.0
  rt: number; // 0.0 .. 1.0
  // System buttons
  back: boolean;
  start: boolean;
  guide: boolean;
  // Sticks
  ls: boolean; // Stick click
  rs: boolean; // Stick click
  lx: number; // -1.0 .. 1.0
  ly: number; // -1.0 .. 1.0
  rx: number; // -1.0 .. 1.0
  ry: number; // -1.0 .. 1.0
}

export type ClientAppMode = 'touch' | 'physical' | 'monitor' | 'calibrate';

export type ControllerSkin = 'auto' | 'xbox' | 'playstation' | 'switch';

/** Controller identity announced by the client that owns the physical pad. */
export interface SlotControllerMeta {
  brand: string;
  name: string;
}

export interface NetworkStats {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  latencyMs: number;
  jitterMs: number;
  packetsPerSec: number;
  bytesSent: number;
  lastPongReceived: number;
}

export interface ClientConfig {
  serverUrl: string;
  useBinaryProtocol: boolean;
  slot: PlayerSlotType;
  deadzone: number;
  vibrationEnabled: boolean;
  vibrationIntensity: 'light' | 'medium' | 'strong';
  touchHaptics: boolean;
  wakeLock: boolean;
  invertY: boolean;
  /** Fallback artwork when a slot has no detected controller or override. */
  monitorSkin: ControllerSkin;
  /** Per-slot artwork override; `auto` uses the detected controller brand. */
  slotSkins: ControllerSkin[];
  /** Per-session gamepad identity → virtual player slot. */
  slotMap: Record<string, PlayerSlotType>;
}
