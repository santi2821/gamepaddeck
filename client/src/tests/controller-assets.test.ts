import { describe, it, expect } from 'vitest';
import {
  getControllerBodySvg,
  getButtonPrompt,
  normalizeBrand,
  XBOX_ASSETS,
  PLAYSTATION_ASSETS,
  SWITCH_ASSETS,
} from '../assets/controllers';

describe('Controller Assets and Prompts', () => {
  it('correctly normalizes controller brands', () => {
    expect(normalizeBrand('sony')).toBe('sony');
    expect(normalizeBrand('PlayStation 5')).toBe('sony');
    expect(normalizeBrand('PS4')).toBe('sony');
    expect(normalizeBrand('xbox')).toBe('xbox');
    expect(normalizeBrand('Xbox Series X')).toBe('xbox');
    expect(normalizeBrand('switch')).toBe('nintendo');
    expect(normalizeBrand('Nintendo Switch Pro')).toBe('nintendo');
    expect(normalizeBrand('generic')).toBe('xbox');
  });

  it('provides full body controller SVG urls for all brands', () => {
    const xboxBody = getControllerBodySvg('xbox');
    const psBody = getControllerBodySvg('sony');
    const switchBody = getControllerBodySvg('switch');

    expect(xboxBody).toBeDefined();
    expect(typeof xboxBody).toBe('string');
    expect(xboxBody.length).toBeGreaterThan(0);

    expect(psBody).toBeDefined();
    expect(typeof psBody).toBe('string');

    expect(switchBody).toBeDefined();
    expect(typeof switchBody).toBe('string');
  });

  it('provides button prompts by name for each brand', () => {
    // Xbox
    expect(getButtonPrompt('xbox', 'a')).toBe(XBOX_ASSETS.buttons.a);
    expect(getButtonPrompt('xbox', 'lb')).toBe(XBOX_ASSETS.buttons.lb);
    expect(getButtonPrompt('xbox', 'xbox')).toBe(XBOX_ASSETS.buttons.xbox);

    // PlayStation
    expect(getButtonPrompt('sony', 'cross')).toBe(PLAYSTATION_ASSETS.buttons.cross);
    expect(getButtonPrompt('sony', 'circle')).toBe(PLAYSTATION_ASSETS.buttons.circle);
    expect(getButtonPrompt('sony', 'l1')).toBe(PLAYSTATION_ASSETS.buttons.l1);
    expect(getButtonPrompt('sony', 'touchpad')).toBe(PLAYSTATION_ASSETS.buttons.touchpad);

    // Switch
    expect(getButtonPrompt('switch', 'a')).toBe(SWITCH_ASSETS.buttons.a);
    expect(getButtonPrompt('switch', 'zl')).toBe(SWITCH_ASSETS.buttons.zl);
    expect(getButtonPrompt('switch', 'capture')).toBe(SWITCH_ASSETS.buttons.capture);
  });

  it('maps standard Gamepad API button indices to brand prompts', () => {
    // Index 0: South button (A on Xbox, Cross on PS, B on Switch)
    expect(getButtonPrompt('xbox', 0)).toBe(XBOX_ASSETS.buttons.a);
    expect(getButtonPrompt('sony', 0)).toBe(PLAYSTATION_ASSETS.buttons.cross);
    expect(getButtonPrompt('nintendo', 0)).toBe(SWITCH_ASSETS.buttons.b);

    // Index 1: East button (B on Xbox, Circle on PS, A on Switch)
    expect(getButtonPrompt('xbox', 1)).toBe(XBOX_ASSETS.buttons.b);
    expect(getButtonPrompt('sony', 1)).toBe(PLAYSTATION_ASSETS.buttons.circle);
    expect(getButtonPrompt('nintendo', 1)).toBe(SWITCH_ASSETS.buttons.a);

    // Index 4: LB / L1 / L
    expect(getButtonPrompt('xbox', 4)).toBe(XBOX_ASSETS.buttons.lb);
    expect(getButtonPrompt('sony', 4)).toBe(PLAYSTATION_ASSETS.buttons.l1);
    expect(getButtonPrompt('nintendo', 4)).toBe(SWITCH_ASSETS.buttons.l);
  });
});
