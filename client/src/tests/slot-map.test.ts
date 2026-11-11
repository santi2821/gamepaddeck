import { describe, it, expect } from 'vitest';
import { assignGamepadSlot, autoAssignSlots, autoAssignGamepadSlots, gamepadSlotKey } from '../lib/slot-map';
import { resolveControllerBrand, skinToBrand } from '../lib/controller-skins';

describe('slot map', () => {
  it('auto-assigns controllers to the lowest free slot', () => {
    const map = autoAssignSlots({}, ['a', 'b', 'c']);
    expect(map).toEqual({ a: 0, b: 1, c: 2 });
  });

  it('assigns two identical connected controllers to distinct slots', () => {
    const pads = [{ id: 'same pad', index: 0 }, { id: 'same pad', index: 1 }];
    const map = autoAssignGamepadSlots({}, pads);
    expect(pads.map((pad) => map[gamepadSlotKey(pad)])).toEqual([0, 1]);
  });

  it('migrates a legacy assignment once to the lowest index for the same id', () => {
    const pads = [{ id: 'Wireless Controller', index: 1 }, { id: 'Wireless Controller', index: 0 }];
    const map = autoAssignGamepadSlots({ 'Wireless Controller': 2, other: 3 }, pads);
    expect(map[gamepadSlotKey(pads[1])]).toBe(2);
    expect(map[gamepadSlotKey(pads[0])]).toBe(0);
    expect(map['Wireless Controller']).toBeUndefined();
    expect(map.other).toBe(3);
    expect(autoAssignGamepadSlots(map, pads)).toBe(map);
  });

  it('migrates a remaining legacy reservation when another identical pad already has a new key', () => {
    const first = { id: 'same', index: 0 };
    const second = { id: 'same', index: 1 };
    const map = autoAssignGamepadSlots({ same: 2, [gamepadSlotKey(second)]: 1 }, [second, first]);
    expect(map[gamepadSlotKey(first)]).toBe(2);
    expect(map[gamepadSlotKey(second)]).toBe(1);
    expect(map.same).toBeUndefined();
  });

  it('does not migrate a legacy reservation over an existing slot owner', () => {
    const a = { id: 'a', index: 0 };
    const b = { id: 'b', index: 1 };
    const map = autoAssignGamepadSlots({ a: 1, [gamepadSlotKey(b)]: 1 }, [a, b]);
    expect(map[gamepadSlotKey(b)]).toBe(1);
    expect(map[gamepadSlotKey(a)]).toBe(0);
    expect(map.a).toBeUndefined();
  });

  it('keeps distinct keys and manual swaps for identical controllers', () => {
    const first = { id: 'same', index: 0 };
    const second = { id: 'same', index: 1 };
    const initial = autoAssignGamepadSlots({}, [first, second]);
    const swapped = assignGamepadSlot(initial, gamepadSlotKey(second), 0);
    expect(swapped[gamepadSlotKey(first)]).toBe(1);
    expect(swapped[gamepadSlotKey(second)]).toBe(0);
    expect(autoAssignGamepadSlots(swapped, [second, first])).toBe(swapped);
  });

  it('retains disconnected assignments and does not merge different ids at the same index', () => {
    const a = { id: 'a', index: 0 };
    const b = { id: 'b', index: 0 };
    const initial = autoAssignGamepadSlots({}, [a]);
    const next = autoAssignGamepadSlots(initial, [b]);
    expect(next[gamepadSlotKey(a)]).toBe(0);
    expect(next[gamepadSlotKey(b)]).toBe(1);
    expect(autoAssignGamepadSlots(next, [a])).toBe(next);
  });

  it('encodes ids and indices without delimiter collisions', () => {
    expect(gamepadSlotKey({ id: 'pad:1', index: 2 })).not.toBe(gamepadSlotKey({ id: 'pad', index: 12 }));
    expect(gamepadSlotKey({ id: 'pad', index: 0 })).not.toBe(gamepadSlotKey({ id: 'pad', index: 1 }));
  });

  it('reclaims historical slots only when needed, without moving connected pads', () => {
    const connected = { id: 'connected', index: 0 };
    const newcomer = { id: 'new', index: 1 };
    const key = gamepadSlotKey(connected);
    const map = autoAssignGamepadSlots({ old0: 0, [key]: 1, old2: 2, old3: 3 }, [newcomer, connected]);
    expect(map[key]).toBe(1);
    expect(map[gamepadSlotKey(newcomer)]).toBe(0);
    expect(map.old0).toBeUndefined();
    expect(map.old2).toBe(2);
    expect(map.old3).toBe(3);
    expect(autoAssignGamepadSlots(map, [connected, newcomer])).toBe(map);
  });

  it('does not evict connected or migrated assignments when more than four pads are present', () => {
    const pads = Array.from({ length: 5 }, (_, index) => ({ id: `pad${index}`, index }));
    const map = autoAssignGamepadSlots({ pad0: 3, old: 0 }, pads);
    expect(map[gamepadSlotKey(pads[0])]).toBe(3);
    expect(pads.slice(0, 4).map((pad) => map[gamepadSlotKey(pad)]).sort()).toEqual([0, 1, 2, 3]);
    expect(map[gamepadSlotKey(pads[4])]).toBeUndefined();
    expect(map.old).toBeUndefined();
  });

  it('keeps existing assignments and fills only new controllers', () => {
    const map = autoAssignSlots({ a: 2 }, ['a', 'b']);
    expect(map).toEqual({ a: 2, b: 0 });
  });

  it('swaps slots when assigning to an occupied slot', () => {
    const map = assignGamepadSlot({ a: 0, b: 1 }, 'b', 0);
    expect(map).toEqual({ a: 1, b: 0 });
  });

  it('frees the old slot when moving an unmapped controller', () => {
    const map = assignGamepadSlot({ a: 0, b: 1 }, 'c', 1);
    expect(map).toEqual({ a: 0, c: 1 });
    expect(map.b).toBeUndefined();
  });
});

describe('controller skins', () => {
  it('maps skins to controller brands', () => {
    expect(skinToBrand('xbox')).toBe('xbox');
    expect(skinToBrand('playstation')).toBe('playstation');
    expect(skinToBrand('switch')).toBe('switch');
  });

  it('uses the detected brand for auto slots', () => {
    expect(resolveControllerBrand('auto', { brand: 'sony', name: 'DualSense' }, 'auto')).toBe('sony');
    expect(resolveControllerBrand('auto', { brand: 'nintendo', name: 'Pro' }, 'auto')).toBe('nintendo');
  });

  it('falls back to the monitor skin when detection is missing', () => {
    expect(resolveControllerBrand('auto', undefined, 'switch')).toBe('switch');
    expect(resolveControllerBrand('auto', { brand: 'generic', name: 'Pad' }, 'auto')).toBe('xbox');
  });

  it('lets an explicit slot skin override detection', () => {
    expect(resolveControllerBrand('playstation', { brand: 'xbox', name: 'Pad' }, 'auto')).toBe(
      'playstation',
    );
  });
});
