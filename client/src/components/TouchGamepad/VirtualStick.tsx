import React, { useRef, useState, useCallback } from 'react';
import { applyDeadzone } from '../../services/protocol';
import { haptics } from '../../services/haptics';

interface VirtualStickProps {
  label: string; // 'LS' | 'RS'
  size?: number; // e.g. 150px
  deadzone?: number;
  color?: string;
  onChange: (x: number, y: number) => void;
  onClickToggle?: (pressed: boolean) => void;
  isClicked?: boolean;
}

export const VirtualStick: React.FC<VirtualStickProps> = ({
  label,
  size = 140,
  deadzone = 0.12,
  color = '#56b8f5',
  onChange,
  onClickToggle,
  isClicked = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeTouchId = useRef<number | null>(null);
  const centerPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [thumbPos, setThumbPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState<boolean>(false);
  const lastTapRef = useRef<number>(0);

  const maxRadius = size / 2 - 18;
  const thumbSize = size * 0.44;

  const updatePosition = useCallback(
    (clientX: number, clientY: number) => {
      const dx = clientX - centerPos.current.x;
      const dy = clientY - centerPos.current.y;
      const dist = Math.hypot(dx, dy);

      let clampedX = dx;
      let clampedY = dy;

      if (dist > maxRadius) {
        clampedX = (dx / dist) * maxRadius;
        clampedY = (dy / dist) * maxRadius;
      }

      setThumbPos({ x: clampedX, y: clampedY });

      // Raw normalized coordinates (-1.0 to 1.0)
      const rawX = clampedX / maxRadius;
      const rawY = clampedY / maxRadius;

      // Apply deadzone and rescale
      const filtered = applyDeadzone(rawX, rawY, deadzone);
      onChange(filtered.x, filtered.y);
    },
    [maxRadius, deadzone, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (activeTouchId.current !== null) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    activeTouchId.current = e.pointerId;
    centerPos.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setIsActive(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    // Double tap detection for L3 / R3 click
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (onClickToggle) {
        haptics.stickClick();
        onClickToggle(!isClicked);
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      haptics.buttonPress();
    }

    updatePosition(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTouchId.current === e.pointerId) {
      e.preventDefault();
      updatePosition(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTouchId.current === e.pointerId) {
      e.preventDefault();
      activeTouchId.current = null;
      setIsActive(false);
      setThumbPos({ x: 0, y: 0 });
      onChange(0, 0);
    }
  };

  const handleStickClickButton = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    haptics.stickClick();
    if (onClickToggle) {
      onClickToggle(!isClicked);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5 select-none touch-none">
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`rounded-full relative flex items-center justify-center cursor-pointer touch-none bg-panel border transition-colors shadow-card ${
          isActive ? 'border-line-strong' : 'border-line'
        }`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
        }}
      >
        {/* Deadzone boundary dashed ring */}
        <div
          className="absolute rounded-full border border-dashed border-line pointer-events-none"
          style={{
            width: `${deadzone * 2 * maxRadius}px`,
            height: `${deadzone * 2 * maxRadius}px`,
          }}
        />

        {/* Crosshair subtle guides */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-line/40 pointer-events-none" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-line/40 pointer-events-none" />

        {/* Active Vector dashed line */}
        {isActive && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line
              x1={size / 2}
              y1={size / 2}
              x2={size / 2 + thumbPos.x}
              y2={size / 2 + thumbPos.y}
              stroke="var(--color-line-strong)"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
          </svg>
        )}

        {/* Thumbstick handle (RomDeck surface-2 pill/disc) */}
        <div
          className={`absolute rounded-full flex items-center justify-center pointer-events-none border shadow-pop ${
            isActive ? 'bg-surface-3 border-line-strong' : 'bg-surface-2 border-line'
          }`}
          style={{
            width: `${thumbSize}px`,
            height: `${thumbSize}px`,
            transform: `translate(${thumbPos.x}px, ${thumbPos.y}px)`,
            transition: isActive ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.9, 0.3, 1)',
            borderColor: isClicked ? 'var(--color-danger)' : undefined,
          }}
        >
          {/* Inner tactile grip ring */}
          <div
            className="rounded-full border border-line/60"
            style={{
              width: `${thumbSize * 0.5}px`,
              height: `${thumbSize * 0.5}px`,
              backgroundColor: isClicked ? 'var(--color-danger)' : isActive ? color : 'var(--color-surface-3)',
            }}
          />
        </div>
      </div>

      {/* Discrete L3/R3 Click Button under the stick (RomDeck pill style) */}
      <button
        type="button"
        onPointerDown={handleStickClickButton}
        className={`h-7 px-3 rounded-full border text-[11px] font-mono tracking-wider transition-all ${
          isClicked
            ? 'bg-danger/20 border-danger/40 text-danger font-semibold'
            : 'bg-surface-2 border-line text-ink-3 hover:text-ink-1 hover:bg-surface-3'
        }`}
      >
        {label} CLICK {isClicked ? '●' : '○'}
      </button>
    </div>
  );
};
