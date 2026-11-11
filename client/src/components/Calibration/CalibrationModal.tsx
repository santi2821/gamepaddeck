import React from 'react';
import {
  type NormalizedGamepadState,
  type PlayerSlotType,
  PLAYER_SLOTS,
} from '../../types/gamepad';
import { CheckCircle2 } from 'lucide-react';
import Sheet from '../Sheet';
import Section from '../ui/Section';
import { BTN_PRIMARY, CHIP } from '../../lib/ui';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: NormalizedGamepadState;
  deadzone: number;
  onDeadzoneChange: (val: number) => void;
  slot: PlayerSlotType;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  state,
  deadzone,
  onDeadzoneChange,
  slot,
}) => {
  const slotMeta = PLAYER_SLOTS[slot];

  const buttonsList = [
    { label: 'A / Cruz', active: state.a },
    { label: 'B / Círculo', active: state.b },
    { label: 'X / Cuadrado', active: state.x },
    { label: 'Y / Triángulo', active: state.y },
    { label: 'LB / L1', active: state.lb },
    { label: 'RB / R1', active: state.rb },
    { label: 'D-pad arriba', active: state.dpadUp },
    { label: 'D-pad abajo', active: state.dpadDown },
    { label: 'D-pad izq.', active: state.dpadLeft },
    { label: 'D-pad der.', active: state.dpadRight },
    { label: 'Start / Menu', active: state.start },
    { label: 'Back / View', active: state.back },
    { label: 'Guía / Xbox', active: state.guide },
    { label: 'L3', active: state.ls },
    { label: 'R3', active: state.rs },
  ];

  return (
    <Sheet
      open={isOpen}
      title="Calibración"
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={
        <button type="button" onClick={onClose} className={BTN_PRIMARY}>
          finalizar
        </button>
      }
    >
      <div className="space-y-4">
        <Section
          raised
          title="Zona muerta"
          description="Un filtro menor da precisión inmediata; uno mayor elimina el drift de sticks desgastados."
          meta={<span className={`${CHIP} font-mono`}>{Math.round(deadzone * 100)}%</span>}
        >
          <input
            type="range"
            min="0.04"
            max="0.30"
            step="0.01"
            value={deadzone}
            aria-label="Zona muerta"
            onChange={(event) => onDeadzoneChange(parseFloat(event.target.value))}
            className="h-1.5 w-full cursor-pointer accent-white"
          />
          <div className="mt-2 flex justify-between font-mono text-[11px] uppercase tracking-wider text-ink-4">
            <span>preciso</span>
            <span>estable</span>
          </div>
        </Section>

        <Section raised title="Palancas" description="El punto se mueve con el stick y el aro punteado marca la zona muerta.">
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'ls', label: 'left stick', x: state.lx, y: state.ly, active: state.ls },
              { key: 'rs', label: 'right stick', x: state.rx, y: state.ry, active: state.rs },
            ].map((stick) => (
              <div key={stick.key} className="flex flex-col items-center gap-2.5">
                <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-line bg-panel">
                  <div
                    className="pointer-events-none absolute rounded-full border border-dashed border-line-strong"
                    style={{
                      width: `${deadzone * 112}px`,
                      height: `${deadzone * 112}px`,
                    }}
                  />
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-line" />
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-line" />
                  <div
                    className="absolute h-3.5 w-3.5 rounded-full shadow-sm transition-transform duration-75"
                    style={{
                      backgroundColor: stick.key === 'ls' ? slotMeta.color : 'var(--color-ink-1)',
                      transform: `translate(${stick.x * 46}px, ${stick.y * 46}px)`,
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink-4">
                  {stick.label}
                </span>
                <span className="font-mono text-[11px] tabular text-ink-3">
                  {stick.x.toFixed(3)} / {stick.y.toFixed(3)} {stick.active ? '· click' : ''}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section raised title="Botones" description="Cada control confirma que la entrada llega al slot activo.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {buttonsList.map((button) => (
              <div
                key={button.label}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px] transition-colors ${
                  button.active
                    ? 'bg-accent-soft font-semibold text-ink-1 ring-1 ring-accent-line'
                    : 'bg-surface-2 text-ink-3'
                }`}
              >
                <span className="truncate">{button.label}</span>
                {button.active && (
                  <CheckCircle2 size={14} aria-hidden="true" className="shrink-0 text-success" />
                )}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </Sheet>
  );
};
