import React, { useRef } from 'react';
import { clamp } from '../../services/protocol';
import { haptics } from '../../services/haptics';
import { type ControllerBrand } from '../../assets/controllers';

interface ShoulderTriggersProps {
  side: 'left' | 'right';
  bumperPressed: boolean;
  triggerValue: number; // 0.0 to 1.0
  onBumperChange: (pressed: boolean) => void;
  onTriggerChange: (val: number) => void;
  brand?: ControllerBrand | string;
  color?: string;
  compact?: boolean;
}

export const ShoulderTriggers: React.FC<ShoulderTriggersProps> = ({
  side,
  bumperPressed,
  triggerValue,
  onBumperChange,
  onTriggerChange,
  brand = 'xbox',
  color = '#56b8f5',
  compact = false,
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const triggerTouchId = useRef<number | null>(null);

  const getLabels = () => {
    const b = (brand || 'xbox').toLowerCase();
    if (b.includes('sony') || b.includes('playstation') || b.includes('ps5')) {
      return {
        bumper: side === 'left' ? 'L1' : 'R1',
        trigger: side === 'left' ? 'L2' : 'R2',
      };
    }
    if (b.includes('switch') || b.includes('nintendo')) {
      return {
        bumper: side === 'left' ? 'L' : 'R',
        trigger: side === 'left' ? 'ZL' : 'ZR',
      };
    }
    return {
      bumper: side === 'left' ? 'LB' : 'RB',
      trigger: side === 'left' ? 'LT' : 'RT',
    };
  };

  const labels = getLabels();

  const handleBumperDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    haptics.bumperPress();
    onBumperChange(true);
  };

  const handleBumperUp = (e: React.PointerEvent) => {
    e.preventDefault();
    onBumperChange(false);
  };

  const updateTriggerFromPoint = (clientY: number) => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const relY = clientY - rect.top;
    const progress = clamp(relY / rect.height, 0.0, 1.0);
    const pressure = clamp(progress < 0.2 ? 1.0 : progress, 0.0, 1.0);
    onTriggerChange(pressure);
  };

  const handleTriggerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    triggerTouchId.current = e.pointerId;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    haptics.triggerPull();
    onTriggerChange(1.0);
  };

  const handleTriggerMove = (e: React.PointerEvent) => {
    if (triggerTouchId.current === e.pointerId) {
      e.preventDefault();
      updateTriggerFromPoint(e.clientY);
    }
  };

  const handleTriggerUp = (e: React.PointerEvent) => {
    if (triggerTouchId.current === e.pointerId) {
      e.preventDefault();
      triggerTouchId.current = null;
      onTriggerChange(0.0);
    }
  };

  return (
    <div
      className={`flex h-11 select-none touch-none items-stretch gap-1.5 ${
        compact ? 'h-10' : ''
      } ${side === 'left' ? 'flex-row' : 'flex-row-reverse'}`}
    >
      {/* BUMPER (LB / RB / L1 / R1) */}
      <button
        type="button"
        onPointerDown={handleBumperDown}
        onPointerUp={handleBumperUp}
        onPointerCancel={handleBumperUp}
        aria-label={labels.bumper}
        aria-pressed={bumperPressed}
        className={`flex items-center justify-center rounded-full transition-all duration-75 ${
          compact ? 'w-14' : 'w-20'
        } ${
          bumperPressed
            ? 'bg-ink-1 text-canvas shadow-sm'
            : 'bg-surface-2 text-ink-2 hover:bg-surface-3'
        }`}
      >
        <span className={compact ? 'text-[11px] font-semibold' : 'text-xs font-semibold'}>
          {labels.bumper}
        </span>
      </button>

      {/* ANALOG TRIGGER (LT / RT / L2 / R2) */}
      <button
        type="button"
        ref={triggerRef as unknown as React.Ref<HTMLButtonElement>}
        onPointerDown={handleTriggerDown}
        onPointerMove={handleTriggerMove}
        onPointerUp={handleTriggerUp}
        onPointerCancel={handleTriggerUp}
        aria-label={labels.trigger}
        className={`relative flex items-center justify-center overflow-hidden rounded-full transition-colors ${
          compact ? 'w-16' : 'w-24'
        } ${triggerValue > 0 ? 'bg-surface-3' : 'bg-surface-2'}`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 transition-all duration-75"
          style={{
            height: `${triggerValue * 100}%`,
            backgroundColor: color,
            opacity: 0.3,
          }}
        />

        <div className="pointer-events-none relative z-10 flex flex-col items-center leading-tight">
          <span
            className={`font-semibold ${compact ? 'text-[11px]' : 'text-xs'} ${
              triggerValue > 0 ? 'text-ink-1' : 'text-ink-2'
            }`}
          >
            {labels.trigger}
          </span>
          <span className={`font-mono tabular text-ink-3 ${compact ? 'text-[11px]' : 'text-[11px]'}`}>
            {Math.round(triggerValue * 100)}%
          </span>
        </div>
      </button>
    </div>
  );
};
