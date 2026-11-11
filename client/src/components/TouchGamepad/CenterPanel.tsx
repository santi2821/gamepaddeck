import React from 'react';
import { type PlayerSlotType, PLAYER_SLOTS } from '../../types/gamepad';
import { haptics } from '../../services/haptics';
import { Gamepad2 } from 'lucide-react';

interface CenterPanelProps {
  back: boolean;
  start: boolean;
  guide: boolean;
  onButtonChange: (btn: 'back' | 'start' | 'guide', pressed: boolean) => void;
  slot?: PlayerSlotType;
  onSlotChange?: (slot: PlayerSlotType) => void;
  compact?: boolean;
}

export const CenterPanel: React.FC<CenterPanelProps> = ({
  back,
  start,
  guide,
  onButtonChange,
  slot,
  onSlotChange,
  compact = false,
}) => {
  const handlePointerDown = (btn: 'back' | 'start' | 'guide') => (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    haptics.buttonPress();
    onButtonChange(btn, true);
  };

  const handlePointerUp = (btn: 'back' | 'start' | 'guide') => (e: React.PointerEvent) => {
    e.preventDefault();
    onButtonChange(btn, false);
  };

  const pill = compact
    ? 'h-8 px-2.5 text-[11px]'
    : 'h-9 px-3.5 text-[11px]';
  const idle = 'bg-surface-2 text-ink-3 hover:bg-surface-3 hover:text-ink-1';
  const pressed = 'bg-ink-1 text-canvas font-semibold';

  return (
    <div className="flex select-none touch-none flex-col items-center justify-center gap-2">
      <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onPointerDown={handlePointerDown('back')}
        onPointerUp={handlePointerUp('back')}
        onPointerCancel={handlePointerUp('back')}
        className={`whitespace-nowrap rounded-full font-mono uppercase tracking-wider transition-all duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${pill} ${
          back ? `${pressed} scale-95` : idle
        }`}
      >
        view
      </button>

      <button
        type="button"
        onPointerDown={handlePointerDown('guide')}
        onPointerUp={handlePointerUp('guide')}
        onPointerCancel={handlePointerUp('guide')}
        aria-label="Botón guía"
        className={`flex items-center justify-center rounded-full transition-all duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          compact ? 'h-8 w-8' : 'h-9 w-9'
        } ${guide ? `${pressed} scale-95` : idle}`}
      >
        <Gamepad2 size={compact ? 14 : 16} aria-hidden="true" />
      </button>

      <button
        type="button"
        onPointerDown={handlePointerDown('start')}
        onPointerUp={handlePointerUp('start')}
        onPointerCancel={handlePointerUp('start')}
        className={`whitespace-nowrap rounded-full font-mono uppercase tracking-wider transition-all duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${pill} ${
          start ? `${pressed} scale-95` : idle
        }`}
      >
        menu
      </button>
      </div>

      {compact && slot !== undefined && (
        <div className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1">
          {([0, 1, 2, 3] as PlayerSlotType[]).map((s) => {
            const isCurrent = slot === s;
            return (
              <button
                key={s}
                type="button"
                aria-label={`Jugar como ${PLAYER_SLOTS[s].name}`}
                aria-pressed={isCurrent}
                onClick={() => {
                  if (onSlotChange) {
                    haptics.slotChange();
                    onSlotChange(s);
                  }
                }}
                className={`h-2 w-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isCurrent ? 'scale-125' : 'opacity-40 hover:opacity-80'
                }`}
                style={{ backgroundColor: PLAYER_SLOTS[s].color }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
