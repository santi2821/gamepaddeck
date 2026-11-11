import type { ControllerSkin, SlotControllerMeta } from '../types/gamepad';
import { type ControllerBrand, normalizeBrand } from '../assets/controllers';

export const CONTROLLER_SKIN_OPTIONS: Array<{ value: ControllerSkin; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'xbox', label: 'Xbox' },
  { value: 'playstation', label: 'PlayStation' },
  { value: 'switch', label: 'Switch' },
];

const SKINS: ControllerSkin[] = ['auto', 'xbox', 'playstation', 'switch'];

export function isControllerSkin(value: unknown): value is ControllerSkin {
  return typeof value === 'string' && (SKINS as string[]).includes(value);
}

export function skinToBrand(skin: ControllerSkin): ControllerBrand {
  if (skin === 'playstation') return 'playstation';
  if (skin === 'switch') return 'switch';
  return 'xbox';
}

/** Auto prefers the controller reported by the physical client, then the
 *  monitor fallback; the default when nothing is known is Xbox 360. */
export function resolveControllerBrand(
  slotSkin: ControllerSkin,
  detected: SlotControllerMeta | undefined,
  fallback: ControllerSkin,
): ControllerBrand {
  if (slotSkin !== 'auto') return skinToBrand(slotSkin);
  if (detected?.brand && detected.brand !== 'generic') return normalizeBrand(detected.brand);
  if (fallback !== 'auto') return skinToBrand(fallback);
  return 'xbox';
}

export function controllerBrandLabel(brand: ControllerBrand | string): string {
  switch (normalizeBrand(brand)) {
    case 'sony':
      return 'PlayStation';
    case 'nintendo':
      return 'Nintendo Switch';
    default:
      return 'Xbox';
  }
}
