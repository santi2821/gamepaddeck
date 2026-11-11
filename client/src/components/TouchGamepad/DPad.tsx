import React, { useRef } from 'react';
import { haptics } from '../../services/haptics';
import {
  xboxDpad,
  psDpad,
  switchDpad,
  type ControllerBrand,
} from '../../assets/controllers';

interface DPadProps {
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
  onChange: (directions: { up: boolean; down: boolean; left: boolean; right: boolean }) => void;
  brand?: ControllerBrand | string;
  size?: number;
}

export const DPad: React.FC<DPadProps> = ({
  dpadUp,
  dpadDown,
  dpadLeft,
  dpadRight,
  onChange,
  brand = 'xbox',
  size = 140,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTouchId = useRef<number | null>(null);

  const getDpadSvg = () => {
    const b = (brand || 'xbox').toLowerCase();
    if (b.includes('sony') || b.includes('playstation') || b.includes('ps5')) {
      return psDpad;
    }
    if (b.includes('switch') || b.includes('nintendo')) {
      return switchDpad;
    }
    return xboxDpad;
  };

  const processPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    // Deadzone in the center
    if (dist < size * 0.16) {
      onChange({ up: false, down: false, left: false, right: false });
      return;
    }

    const angle = Math.atan2(dy, dx);

    let up = false;
    let down = false;
    let left = false;
    let right = false;

    // Up: [-3PI/4, -PI/4]
    if (angle > -2.356 && angle < -0.785) {
      up = true;
    }
    // Down: [PI/4, 3PI/4]
    if (angle > 0.785 && angle < 2.356) {
      down = true;
    }
    // Right: [-PI/4, PI/4]
    if (angle >= -0.785 && angle <= 0.785) {
      right = true;
    }
    // Left: [3PI/4, PI] or [-PI, -3PI/4]
    if (angle >= 2.356 || angle <= -2.356) {
      left = true;
    }

    onChange({ up, down, left, right });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    activeTouchId.current = e.pointerId;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    haptics.buttonPress();
    processPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTouchId.current === e.pointerId) {
      e.preventDefault();
      processPoint(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTouchId.current === e.pointerId) {
      e.preventDefault();
      activeTouchId.current = null;
      onChange({ up: false, down: false, left: false, right: false });
    }
  };

  const isAnyPressed = dpadUp || dpadDown || dpadLeft || dpadRight;
  const dpadSvg = getDpadSvg();

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex items-center justify-center select-none cursor-pointer"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        touchAction: 'none',
      }}
    >
      {/* Background Subtle Disc */}
      <div
        className="absolute rounded-full bg-surface-2/60 border border-line/40 pointer-events-none"
        style={{
          width: `${size * 0.94}px`,
          height: `${size * 0.94}px`,
        }}
      />

      {/* Real Authentic D-Pad SVG */}
      <img
        src={dpadSvg}
        alt="D-Pad"
        className="absolute pointer-events-none select-none transition-transform duration-75"
        style={{
          width: `${size * 0.88}px`,
          height: `${size * 0.88}px`,
          filter: isAnyPressed
            ? 'brightness(1.2) drop-shadow(0 0 8px rgba(255,255,255,0.3))'
            : 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))',
          transform: isAnyPressed ? 'scale(0.96)' : 'scale(1)',
        }}
        draggable={false}
      />

      {/* Directional Active Glow Indicators */}
      {dpadUp && (
        <div
          className="absolute w-4 h-4 rounded-full bg-ink-1/70 blur-[3px] pointer-events-none"
          style={{ top: `${size * 0.12}px` }}
        />
      )}
      {dpadDown && (
        <div
          className="absolute w-4 h-4 rounded-full bg-ink-1/70 blur-[3px] pointer-events-none"
          style={{ bottom: `${size * 0.12}px` }}
        />
      )}
      {dpadLeft && (
        <div
          className="absolute w-4 h-4 rounded-full bg-ink-1/70 blur-[3px] pointer-events-none"
          style={{ left: `${size * 0.12}px` }}
        />
      )}
      {dpadRight && (
        <div
          className="absolute w-4 h-4 rounded-full bg-ink-1/70 blur-[3px] pointer-events-none"
          style={{ right: `${size * 0.12}px` }}
        />
      )}
    </div>
  );
};
