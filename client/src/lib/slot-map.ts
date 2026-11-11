import type { PlayerSlotType } from '../types/gamepad';

export type GamepadSlotMap = Record<string, PlayerSlotType>;

const SLOTS: PlayerSlotType[] = [0, 1, 2, 3];

/** Browser gamepad indices distinguish identical devices within a session. */
export interface GamepadSlotIdentity {
  id: string;
  index: number;
}

/** Use the same key for assignment, display, metadata and input routing. */
export function gamepadSlotKey(gamepad: GamepadSlotIdentity): string {
  return `gamepad:${JSON.stringify([gamepad.id, gamepad.index])}`;
}

/** Migrate legacy id-only entries and assign connected gamepads free slots.
 * When several pads share an id, its legacy slot goes to the lowest index.
 * Disconnected reservations are reclaimed only when a connected pad needs
 * the slot. An index is session-scoped and can change on reconnection. */
export function autoAssignGamepadSlots(
  map: GamepadSlotMap,
  gamepads: readonly GamepadSlotIdentity[],
): GamepadSlotMap {
  let next = map;
  const groups = new Map<string, GamepadSlotIdentity[]>();
  for (const gamepad of gamepads) {
    const group = groups.get(gamepad.id) ?? [];
    group.push(gamepad);
    groups.set(gamepad.id, group);
  }
  for (const [id, group] of groups) {
    if (!Object.hasOwn(next, id)) continue;
    const ordered = [...group].sort((a, b) => a.index - b.index);
    const unmapped = ordered.find((gamepad) => !Object.hasOwn(next, gamepadSlotKey(gamepad)));
    const slot = next[id];
    const slotAlreadyOwned = Object.keys(next).some((key) => key !== id && next[key] === slot);
    if (next === map) next = { ...map };
    if (unmapped && !slotAlreadyOwned) next[gamepadSlotKey(unmapped)] = slot;
    delete next[id];
  }
  const keys = gamepads.map(gamepadSlotKey);
  const connected = new Set(keys);
  const activeSlots = new Set(keys.flatMap((key) =>
    Object.hasOwn(next, key) ? [next[key]] : [],
  ));

  for (const key of keys) {
    if (Object.hasOwn(next, key)) continue;
    const reserved = new Set(Object.values(next));
    const slot = SLOTS.find((candidate) => !reserved.has(candidate))
      ?? SLOTS.find((candidate) => !activeSlots.has(candidate));
    if (slot === undefined) continue;
    if (next === map) next = { ...map };
    for (const oldKey of Object.keys(next)) {
      if (!connected.has(oldKey) && next[oldKey] === slot) delete next[oldKey];
    }
    next[key] = slot;
    activeSlots.add(slot);
  }
  return next;
}

/** Assign a controller to a slot, swapping with the controller that owns it. */
export function assignGamepadSlot(
  map: GamepadSlotMap,
  gamepadId: string,
  slot: PlayerSlotType,
): GamepadSlotMap {
  const next: GamepadSlotMap = { ...map };
  const previousSlot = next[gamepadId];
  const occupant = Object.keys(next).find((id) => id !== gamepadId && next[id] === slot);

  if (occupant) {
    if (previousSlot === undefined) {
      delete next[occupant];
    } else {
      next[occupant] = previousSlot;
    }
  }

  next[gamepadId] = slot;
  return next;
}

/** Give every unmapped controller the lowest free slot. Keeps assignments for
 *  disconnected controllers so reconnecting a pad restores its slot. */
export function autoAssignSlots(map: GamepadSlotMap, gamepadIds: string[]): GamepadSlotMap {
  const used = new Set<PlayerSlotType>(Object.values(map));
  let next = map;

  for (const id of gamepadIds) {
    if (next[id] !== undefined) continue;
    const free = SLOTS.find((slot) => !used.has(slot));
    if (free === undefined) continue;
    if (next === map) next = { ...map };
    next[id] = free;
    used.add(free);
  }

  return next;
}
