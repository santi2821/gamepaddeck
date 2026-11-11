import React from 'react';
import { type NormalizedGamepadState } from '../../types/gamepad';
import {
  getControllerBodySvg,
  normalizeBrand,
  type ControllerBrand,
} from '../../assets/controllers';

interface RealControllerVisualizerProps {
  state: NormalizedGamepadState | null;
  accentColor: string;
  brand?: ControllerBrand | string;
}

const IDLE_STATE: NormalizedGamepadState = {
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
  ls: false,
  rs: false,
  back: false,
  start: false,
  guide: false,
  lx: 0,
  ly: 0,
  rx: 0,
  ry: 0,
};

type ResolvedBrand = 'xbox' | 'sony' | 'nintendo';

const ART_ASPECT: Record<ResolvedBrand, string> = {
  xbox: '1.6087',
  sony: '1.7982',
  nintendo: '1.3762',
};

const ART_LABEL: Record<ResolvedBrand, string> = {
  xbox: 'Xbox',
  sony: 'PlayStation',
  nintendo: 'Nintendo Switch',
};

interface MarkerLayout {
  ls: React.CSSProperties;
  rs: React.CSSProperties;
  dpad: React.CSSProperties;
  bumperLeft: React.CSSProperties;
  bumperRight: React.CSSProperties;
}

const LAYOUTS: Record<ResolvedBrand, MarkerLayout> = {
  xbox: {
    ls: { left: '26%', top: '32%' },
    rs: { right: '35%', bottom: '26%' },
    dpad: { left: '36%', bottom: '26%' },
    bumperLeft: { left: '28%', top: '14%' },
    bumperRight: { right: '28%', top: '14%' },
  },
  sony: {
    ls: { left: '35%', top: '59%' },
    rs: { right: '30%', top: '59%' },
    dpad: { left: '24%', top: '30%' },
    bumperLeft: { left: '20%', top: '9%' },
    bumperRight: { right: '20%', top: '9%' },
  },
  nintendo: {
    ls: { left: '20%', top: '25%' },
    rs: { right: '30%', top: '40%' },
    dpad: { left: '31%', top: '36%' },
    bumperLeft: { left: '18%', top: '7%' },
    bumperRight: { right: '18%', top: '7%' },
  },
};

/** Device art for a player slot plus live stick and D-pad markers. The artwork
 *  follows the detected controller brand; buttons and triggers stay in the card
 *  telemetry so the art is never drawn twice. */
export const RealControllerVisualizer: React.FC<RealControllerVisualizerProps> = ({
  state,
  accentColor,
  brand = 'xbox',
}) => {
  const norm = state || IDLE_STATE;
  const resolved = normalizeBrand(brand) as ResolvedBrand;
  const layout = LAYOUTS[resolved];

  const leftStickActive = Math.abs(norm.lx) > 0.02 || Math.abs(norm.ly) > 0.02 || norm.ls;
  const rightStickActive = Math.abs(norm.rx) > 0.02 || Math.abs(norm.ry) > 0.02 || norm.rs;
  const dpadActive = norm.dpadUp || norm.dpadDown || norm.dpadLeft || norm.dpadRight;

  const stickStyle = (active: boolean): React.CSSProperties => ({
    backgroundColor: active ? accentColor : '#3a3a3a',
    boxShadow: active ? `0 0 10px ${accentColor}88` : 'none',
  });

  return (
    <div
      className="relative mx-auto flex w-full max-w-[320px] items-center justify-center select-none"
      style={{ aspectRatio: ART_ASPECT[resolved] }}
    >
      <img
        src={getControllerBodySvg(resolved)}
        alt={`${ART_LABEL[resolved]} Controller`}
        className="pointer-events-none relative h-full w-full select-none object-contain drop-shadow-[0_16px_28px_rgba(0,0,0,0.55)]"
        draggable={false}
      />

      {/* Left analog stick */}
      <div
        className="pointer-events-none absolute h-7 w-7 rounded-full border border-white/10 transition-transform duration-75"
        style={{ ...layout.ls, transform: `translate(${norm.lx * 10}px, ${norm.ly * 10}px)` }}
      >
        <div
          className="absolute inset-[30%] rounded-full transition-colors"
          style={stickStyle(leftStickActive)}
        />
      </div>

      {/* Right analog stick */}
      <div
        className="pointer-events-none absolute h-7 w-7 rounded-full border border-white/10 transition-transform duration-75"
        style={{ ...layout.rs, transform: `translate(${norm.rx * 10}px, ${norm.ry * 10}px)` }}
      >
        <div
          className="absolute inset-[30%] rounded-full transition-colors"
          style={stickStyle(rightStickActive)}
        />
      </div>

      {/* D-pad directions */}
      <div
        className="pointer-events-none absolute flex h-8 w-8 items-center justify-center"
        aria-hidden="true"
        style={layout.dpad}
      >
        {norm.dpadUp && <span className="absolute top-0 h-2 w-2 rounded-full bg-ink-1 shadow-sm" />}
        {norm.dpadDown && (
          <span className="absolute bottom-0 h-2 w-2 rounded-full bg-ink-1 shadow-sm" />
        )}
        {norm.dpadLeft && (
          <span className="absolute left-0 h-2 w-2 rounded-full bg-ink-1 shadow-sm" />
        )}
        {norm.dpadRight && (
          <span className="absolute right-0 h-2 w-2 rounded-full bg-ink-1 shadow-sm" />
        )}
        {!dpadActive && <span className="h-px w-4 bg-white/0" aria-hidden="true" />}
      </div>

      {/* Shoulder bumpers */}
      {norm.lb && (
        <div
          className="pointer-events-none absolute h-2.5 w-10 rounded-full bg-ink-1/80 blur-[1px]"
          style={layout.bumperLeft}
        />
      )}
      {norm.rb && (
        <div
          className="pointer-events-none absolute h-2.5 w-10 rounded-full bg-ink-1/80 blur-[1px]"
          style={layout.bumperRight}
        />
      )}
    </div>
  );
};
