import React, { useEffect, useRef, useState } from 'react';
import {
  type NormalizedGamepadState,
  type PlayerSlotType,
  PLAYER_SLOTS,
} from '../../types/gamepad';
import { VirtualStick } from './VirtualStick';
import { DPad } from './DPad';
import { ActionButtons } from './ActionButtons';
import { ShoulderTriggers } from './ShoulderTriggers';
import { CenterPanel } from './CenterPanel';
import { type ControllerBrand } from '../../assets/controllers';
import { haptics } from '../../services/haptics';

interface TouchGamepadProps {
  state: NormalizedGamepadState;
  onStateUpdate: (updater: (prev: NormalizedGamepadState) => NormalizedGamepadState) => void;
  slot: PlayerSlotType;
  onSlotChange?: (slot: PlayerSlotType) => void;
  deadzone?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const TouchGamepad: React.FC<TouchGamepadProps> = ({
  state,
  onStateUpdate,
  slot,
  onSlotChange,
  deadzone = 0.12,
}) => {
  const [skin, setSkin] = useState<ControllerBrand>('xbox');
  const [scale, setScale] = useState(1);
  const [compact, setCompact] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentSlotMeta = PLAYER_SLOTS[slot];
  const accentColor = currentSlotMeta.color;

  // The pad is drawn for an 880×430 landscape viewport; every control scales
  // with the real one so the layout never overflows a phone in either axis.
  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const next = Math.min(1, height / 430, width / 860);
      setScale(clamp(next, 0.72, 1));
      setCompact(width < 560);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const stickSize = Math.round(128 * scale);
  const dpadSize = Math.round(116 * scale);
  const actionSize = Math.round(130 * scale);

  const handleCycleSkin = () => {
    haptics.buttonPress();
    setSkin((prev) => {
      if (prev === 'xbox') return 'playstation';
      if (prev === 'playstation') return 'switch';
      return 'xbox';
    });
  };

  const getSkinLabel = () => {
    switch (skin) {
      case 'playstation':
        return 'PS5';
      case 'switch':
        return 'Switch';
      case 'xbox':
      default:
        return 'Xbox';
    }
  };

  return (
    <div
      ref={rootRef}
      className="safe-padding relative box-border flex h-full w-full flex-1 touch-none select-none flex-col justify-between overflow-hidden bg-canvas px-2 py-2"
    >
      {/* TOP ROW: SHOULDERS, TRIGGERS & CENTER HUD ISLAND */}
      <div className="z-20 flex w-full items-center justify-between gap-2">
        <ShoulderTriggers
          side="left"
          bumperPressed={state.lb}
          triggerValue={state.lt}
          onBumperChange={(pressed) =>
            onStateUpdate((prev) => ({ ...prev, lb: pressed }))
          }
          onTriggerChange={(val) => onStateUpdate((prev) => ({ ...prev, lt: val }))}
          brand={skin}
          color={accentColor}
          compact={compact}
        />

        <div className="floating-layer flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-nav-glass px-2 py-1.5 shadow-card">
          <button
            type="button"
            onClick={handleCycleSkin}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-1 transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title="Cambiar aspecto del mando (Xbox / PlayStation / Switch)"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <span>{getSkinLabel()}</span>
          </button>

          <div
            className={`flex items-center gap-0.5 rounded-full bg-surface-2 px-1 py-0.5 ${
              compact ? 'hidden' : ''
            }`}
          >
            {([0, 1, 2, 3] as PlayerSlotType[]).map((s) => {
              const isCurrent = slot === s;
              const meta = PLAYER_SLOTS[s];
              return (
                <button
                  key={s}
                  type="button"
                  aria-label={`Jugar como ${meta.name}`}
                  aria-pressed={isCurrent}
                  onClick={() => {
                    if (onSlotChange) {
                      haptics.slotChange();
                      onSlotChange(s);
                    }
                  }}
                  className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isCurrent ? 'text-canvas' : 'text-ink-4 hover:text-ink-1'
                  }`}
                  style={{ backgroundColor: isCurrent ? meta.color : 'transparent' }}
                >
                  P{s + 1}
                </button>
              );
            })}
          </div>
        </div>

        <ShoulderTriggers
          side="right"
          bumperPressed={state.rb}
          triggerValue={state.rt}
          onBumperChange={(pressed) =>
            onStateUpdate((prev) => ({ ...prev, rb: pressed }))
          }
          onTriggerChange={(val) => onStateUpdate((prev) => ({ ...prev, rt: val }))}
          brand={skin}
          color={accentColor}
          compact={compact}
        />
      </div>

      {/* MAIN GAMEPAD BODY - ERGONOMIC HANDHELD LAYOUT */}
      <div className="z-10 flex w-full flex-1 items-center justify-between gap-2 px-1">
        {/* LEFT WING: LEFT STICK (UPPER) & D-PAD (LOWER) */}
        <div className="flex flex-col items-center justify-center gap-2">
          <VirtualStick
            label="LS"
            size={stickSize}
            deadzone={deadzone}
            color={accentColor}
            onChange={(x, y) => onStateUpdate((prev) => ({ ...prev, lx: x, ly: y }))}
            onClickToggle={(pressed) => onStateUpdate((prev) => ({ ...prev, ls: pressed }))}
            isClicked={state.ls}
          />

          <DPad
            dpadUp={state.dpadUp}
            dpadDown={state.dpadDown}
            dpadLeft={state.dpadLeft}
            dpadRight={state.dpadRight}
            onChange={(dirs) =>
              onStateUpdate((prev) => ({
                ...prev,
                dpadUp: dirs.up,
                dpadDown: dirs.down,
                dpadLeft: dirs.left,
                dpadRight: dirs.right,
              }))
            }
            brand={skin}
            size={dpadSize}
          />
        </div>

        {/* CENTER BUTTONS: VIEW / GUIDE / MENU */}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <CenterPanel
            back={state.back}
            start={state.start}
            guide={state.guide}
            onButtonChange={(btn, pressed) =>
              onStateUpdate((prev) => ({ ...prev, [btn]: pressed }))
            }
            slot={slot}
            onSlotChange={onSlotChange}
            compact={compact}
          />
        </div>

        {/* RIGHT WING: ACTION BUTTONS (UPPER) & RIGHT STICK (LOWER) */}
        <div className="flex flex-col items-center justify-center gap-2">
          <ActionButtons
            a={state.a}
            b={state.b}
            x={state.x}
            y={state.y}
            onButtonChange={(btn, pressed) =>
              onStateUpdate((prev) => ({ ...prev, [btn]: pressed }))
            }
            brand={skin}
            size={actionSize}
          />

          <VirtualStick
            label="RS"
            size={stickSize}
            deadzone={deadzone}
            color={accentColor}
            onChange={(x, y) => onStateUpdate((prev) => ({ ...prev, rx: x, ry: y }))}
            onClickToggle={(pressed) => onStateUpdate((prev) => ({ ...prev, rs: pressed }))}
            isClicked={state.rs}
          />
        </div>
      </div>
    </div>
  );
};
