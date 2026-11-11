import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ActionButtons } from '../components/TouchGamepad/ActionButtons';
import { DPad } from '../components/TouchGamepad/DPad';
import { ShoulderTriggers } from '../components/TouchGamepad/ShoulderTriggers';
import { RealControllerVisualizer } from '../components/PcDashboard/RealControllerVisualizer';
import { createEmptyNormalizedState } from '../services/protocol';

describe('GamepadDeck RomDeck UI Redesign Component Tests', () => {
  it('renders ActionButtons with authentic Xbox SVG icons', () => {
    const html = renderToString(
      <ActionButtons
        a={false}
        b={false}
        x={false}
        y={false}
        onButtonChange={() => {}}
        brand="xbox"
        size={140}
      />
    );

    expect(html).toContain('img');
    expect(html).toContain('alt="Button a"');
    expect(html).toContain('alt="Button b"');
    expect(html).toContain('alt="Button x"');
    expect(html).toContain('alt="Button y"');
  });

  it('renders ActionButtons with PlayStation skin', () => {
    const html = renderToString(
      <ActionButtons
        a={true}
        b={false}
        x={false}
        y={false}
        onButtonChange={() => {}}
        brand="playstation"
        size={140}
      />
    );

    expect(html).toContain('alt="Button a"');
    expect(html).toContain('alt="Button y"');
  });

  it('renders DPad with authentic SVG vector', () => {
    const html = renderToString(
      <DPad
        dpadUp={true}
        dpadDown={false}
        dpadLeft={false}
        dpadRight={false}
        onChange={() => {}}
        brand="xbox"
        size={120}
      />
    );

    expect(html).toContain('alt="D-Pad"');
    expect(html).toContain('dpad');
  });

  it('renders ShoulderTriggers with correct brand labels', () => {
    const html = renderToString(
      <ShoulderTriggers
        side="left"
        bumperPressed={false}
        triggerValue={0.75}
        onBumperChange={() => {}}
        onTriggerChange={() => {}}
        brand="xbox"
      />
    );

    expect(html).toContain('LB');
    expect(html).toContain('LT');
    expect(html).toContain('75%');
  });

  it('renders ShoulderTriggers for PlayStation (L1/L2)', () => {
    const html = renderToString(
      <ShoulderTriggers
        side="left"
        bumperPressed={true}
        triggerValue={1.0}
        onBumperChange={() => {}}
        onTriggerChange={() => {}}
        brand="playstation"
      />
    );

    expect(html).toContain('L1');
    expect(html).toContain('L2');
    expect(html).toContain('100%');
  });

  it('renders RealControllerVisualizer with authentic controller image', () => {
    const state = createEmptyNormalizedState();
    state.a = true;
    state.lx = 0.5;
    state.ly = -0.5;

    const html = renderToString(
      <RealControllerVisualizer
        state={state}
        accentColor="#56b8f5"
      />
    );

    expect(html).toContain('alt="Xbox Controller"');
    expect(html).toContain('controller');
  });

  it('renders the detected PlayStation artwork', () => {
    const html = renderToString(
      <RealControllerVisualizer
        state={createEmptyNormalizedState()}
        accentColor="#56b8f5"
        brand="playstation"
      />
    );

    expect(html).toContain('alt="PlayStation Controller"');
    expect(html).toContain('controller');
  });

  it('renders the detected Switch artwork', () => {
    const html = renderToString(
      <RealControllerVisualizer
        state={createEmptyNormalizedState()}
        accentColor="#56b8f5"
        brand="nintendo"
      />
    );

    expect(html).toContain('alt="Nintendo Switch Controller"');
  });
});
