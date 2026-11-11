import {
  type NormalizedGamepadState,
  type PadReport,
} from '../types/gamepad';
import {
  applyDeadzone,
  clamp,
  createEmptyNormalizedState,
  normalizedToPadReport,
} from './protocol';

export interface PhysicalGamepadInfo {
  index: number;
  id: string;
  name: string;
  brand: 'sony' | 'xbox' | 'nintendo' | 'generic';
  mapping: string;
  connected: boolean;
  timestamp: number;
}

/**
 * Identify gamepad brand and friendly display name
 */
export function identifyGamepad(gp: Gamepad): PhysicalGamepadInfo {
  const idLower = gp.id.toLowerCase();
  let brand: 'sony' | 'xbox' | 'nintendo' | 'generic' = 'generic';
  let name = gp.id;

  const isSony = idLower.includes('sony') || idLower.includes('054c') || idLower.includes('playstation');
  const isXbox = idLower.includes('xbox') || idLower.includes('x-box') || idLower.includes('045e') || idLower.includes('microsoft');
  const isNintendo = idLower.includes('switch') || idLower.includes('nintendo') || idLower.includes('057e') || idLower.includes('joy-con');

  if (isSony || idLower.includes('dualsense') || idLower.includes('dualshock')) {
    brand = 'sony';
    if (idLower.includes('dualsense') || idLower.includes('0ce6') || idLower.includes('0df2')) {
      name = 'Sony DualSense (PS5)';
    } else if (idLower.includes('dualshock') || idLower.includes('05c4') || idLower.includes('09cc')) {
      name = 'Sony DualShock 4 (PS4)';
    } else {
      name = 'PlayStation Controller';
    }
  } else if (isXbox) {
    brand = 'xbox';
    name = 'Xbox Wireless Controller';
  } else if (isNintendo) {
    brand = 'nintendo';
    name = 'Nintendo Switch Controller';
  } else {
    // Clean up generic name
    const vendorMatch = gp.id.match(/(.+?)\s*\(/);
    if (vendorMatch && vendorMatch[1]) {
      name = vendorMatch[1].trim();
    }
  }

  return {
    index: gp.index,
    id: gp.id,
    name,
    brand,
    mapping: gp.mapping || 'standard',
    connected: gp.connected,
    timestamp: gp.timestamp,
  };
}

/**
 * Normalize browser Gamepad object to NormalizedGamepadState
 */
export function normalizePhysicalGamepad(
  gp: Gamepad,
  deadzone: number = 0.12
): NormalizedGamepadState {
  const state = createEmptyNormalizedState();

  const getButton = (index: number): boolean => {
    const b = gp.buttons[index];
    return b ? b.pressed || b.value > 0.5 : false;
  };

  const getButtonValue = (index: number): number => {
    const b = gp.buttons[index];
    return b ? clamp(b.value, 0.0, 1.0) : 0.0;
  };

  // Standard W3C mapping
  state.a = getButton(0);
  state.b = getButton(1);
  state.x = getButton(2);
  state.y = getButton(3);

  state.lb = getButton(4);
  state.rb = getButton(5);
  state.lt = getButtonValue(6);
  state.rt = getButtonValue(7);

  state.back = getButton(8);
  state.start = getButton(9);
  state.ls = getButton(10);
  state.rs = getButton(11);

  state.dpadUp = getButton(12);
  state.dpadDown = getButton(13);
  state.dpadLeft = getButton(14);
  state.dpadRight = getButton(15);

  state.guide = getButton(16);

  // Axes with deadzone
  const rawLx = gp.axes[0] ?? 0;
  const rawLy = gp.axes[1] ?? 0;
  const rawRx = gp.axes[2] ?? 0;
  const rawRy = gp.axes[3] ?? 0;

  const leftFiltered = applyDeadzone(rawLx, rawLy, deadzone);
  const rightFiltered = applyDeadzone(rawRx, rawRy, deadzone);

  state.lx = leftFiltered.x;
  state.ly = leftFiltered.y;
  state.rx = rightFiltered.x;
  state.ry = rightFiltered.y;

  return state;
}

/**
 * Fast direct conversion from Gamepad to PadReport
 */
export function physicalGamepadToPadReport(
  gp: Gamepad,
  deadzone: number = 0.12
): PadReport {
  const norm = normalizePhysicalGamepad(gp, deadzone);
  return normalizedToPadReport(norm);
}

/**
 * Listen for gamepad connect/disconnect events
 */
export function onGamepadConnectionChange(
  onConnected: (gp: Gamepad) => void,
  onDisconnected: (gp: Gamepad) => void
): () => void {
  const handleConnected = (e: GamepadEvent) => {
    onConnected(e.gamepad);
  };
  const handleDisconnected = (e: GamepadEvent) => {
    onDisconnected(e.gamepad);
  };

  window.addEventListener('gamepadconnected', handleConnected);
  window.addEventListener('gamepaddisconnected', handleDisconnected);

  return () => {
    window.removeEventListener('gamepadconnected', handleConnected);
    window.removeEventListener('gamepaddisconnected', handleDisconnected);
  };
}

/**
 * Get all currently connected gamepads
 */
export function getConnectedGamepads(): Gamepad[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) {
    return [];
  }
  return Array.from(navigator.getGamepads()).filter((g): g is Gamepad => g !== null && g.connected);
}
