import type { NormalizedGamepadState, PadReport, PlayerSlotType } from '../types/gamepad';
import { normalizePhysicalGamepad } from '../services/gamepad-api';
import { normalizedToPadReport } from '../services/protocol';
import { gamepadSlotKey, type GamepadSlotMap } from './slot-map';

/** Poll independently of display refresh; timers may still be throttled by the host. */
export function startInputPolling(poll: () => void): () => void {
  const timer = setInterval(poll, 8);
  return () => clearInterval(timer);
}

export function sameGamepadState(a: NormalizedGamepadState, b: NormalizedGamepadState): boolean {
  return (Object.keys(a) as (keyof NormalizedGamepadState)[]).every((key) => a[key] === b[key]);
}

export function samePadReport(a: PadReport | undefined, b: PadReport | undefined): boolean {
  return a === b || (!!a && !!b && a.buttons === b.buttons && a.l2 === b.l2 && a.r2 === b.r2 &&
    a.lx === b.lx && a.ly === b.ly && a.rx === b.rx && a.ry === b.ry);
}

export function sameReports(a: Record<number, PadReport>, b: Record<number, PadReport>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => samePadReport(a[Number(key)], b[Number(key)]));
}

/** Capture every assigned slot on every tick, including unchanged reports. */
export function pollPhysicalPads(
  pads: readonly Gamepad[], slotMap: GamepadSlotMap, deadzone: number, invertY: boolean,
  onReport: (slot: PlayerSlotType, report: PadReport, state: NormalizedGamepadState, pad: Gamepad) => void,
): Set<PlayerSlotType> {
  const slots = new Set<PlayerSlotType>();
  for (const pad of pads) {
    const slot = slotMap[gamepadSlotKey(pad)];
    if (slot === undefined || slot < 0 || slot > 3 || slots.has(slot)) continue;
    slots.add(slot);
    const state = normalizePhysicalGamepad(pad, deadzone);
    onReport(slot, normalizedToPadReport(state, invertY), state, pad);
  }
  return slots;
}
