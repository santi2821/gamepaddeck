import { gamepadSlotKey } from '../../lib/slot-map';
import React from 'react';
import {
  type NormalizedGamepadState,
  type PlayerSlotType,
  PLAYER_SLOTS,
} from '../../types/gamepad';
import { getConnectedGamepads, type PhysicalGamepadInfo } from '../../services/gamepad-api';
import { captureGamepads, isTauriDesktop } from '../../lib/capture-origin';
import { Gamepad2, AlertCircle, Plus, Zap } from 'lucide-react';
import PageHeading from '../ui/PageHeading';
import Section from '../ui/Section';
import { BTN, PANEL } from '../../lib/ui';
import {
  ControllerImage,
  ButtonPrompt,
  type ControllerBrand,
} from '../../assets/controllers';
import { haptics } from '../../services/haptics';

interface PhysicalGamepadViewProps {
  connectedGamepads: PhysicalGamepadInfo[];
  selectedGamepadIndex: number;
  onSelectGamepad: (index: number) => void;
  state: NormalizedGamepadState;
  slot: PlayerSlotType;
  slotMap: Record<string, PlayerSlotType>;
  onAssignSlot: (gamepadId: string, slot: PlayerSlotType) => void;
  onRefreshGamepads: () => void;
  pollingHz: number;
  hardwareEmulated: boolean | null;
}

const StickRadar: React.FC<{
  label: string;
  x: number;
  y: number;
  clicked: boolean;
  color?: string;
}> = ({ label, x, y, clicked, color }) => (
  <div className="flex flex-col items-center gap-2.5">
    <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-line bg-panel">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-line" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-line" />
      <div
        className="absolute h-4 w-4 rounded-full shadow-sm"
        style={{
          backgroundColor: color ?? 'var(--color-ink-1)',
          transform: `translate(${x * 40}px, ${y * 40}px)`,
        }}
      />
    </div>
    <span className="font-mono text-[11px] uppercase tracking-wider text-ink-4">{label}</span>
    <span className="font-mono text-[11px] tabular text-ink-3">
      {x.toFixed(2)}, {y.toFixed(2)} {clicked ? '· click' : ''}
    </span>
  </div>
);

export const PhysicalGamepadView: React.FC<PhysicalGamepadViewProps> = ({
  connectedGamepads,
  selectedGamepadIndex,
  onSelectGamepad,
  state,
  slot,
  slotMap,
  onAssignSlot,
  onRefreshGamepads,
  pollingHz,
  hardwareEmulated,
}) => {
  const desktopCapture = isTauriDesktop(typeof window === 'undefined' ? undefined : window);
  const activePad =
    connectedGamepads.find((g) => g.index === selectedGamepadIndex) || connectedGamepads[0];
  const activeBrand: ControllerBrand = activePad?.brand || 'xbox';
  const activeSlot = activePad ? (slotMap[gamepadSlotKey(activePad)] ?? slot) : slot;
  const currentSlotMeta = PLAYER_SLOTS[activeSlot];
  const accentColor = currentSlotMeta.color;
  const pcDeviceLabel =
    hardwareEmulated === null
      ? 'mando virtual'
      : hardwareEmulated
        ? 'Xbox 360'
        : 'sin mando virtual';

  const handleTestRumble = () => {
    haptics.heavyImpact();
    try {
      if (typeof navigator !== 'undefined' && 'getGamepads' in navigator) {
        const pad = captureGamepads(getConnectedGamepads).find((item) => item.index === selectedGamepadIndex);
        if (pad && (pad as any).vibrationActuator) {
          (pad as any).vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: 400,
            weakMagnitude: 0.8,
            strongMagnitude: 0.8,
          });
        }
      }
    } catch {
      // Ignore
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeading
        title="Mando físico"
        description={desktopCapture ? 'Detecta mandos Sony y Nintendo identificables conectados a esta PC.' : 'Detecta mandos conectados al navegador o al celular. Un hub OTG admite hasta cuatro mandos en un teléfono.'}
        actions={
          <button type="button" onClick={handleTestRumble} className={BTN}>
            <Zap size={15} aria-hidden="true" />
            <span>Probar vibración</span>
          </button>
        }
      />

      <div className={`${PANEL} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4`}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-2">
            <Gamepad2 size={17} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink-1">
              {connectedGamepads.length > 0
                ? `${connectedGamepads.length} ${connectedGamepads.length === 1 ? 'mando detectado' : 'mandos detectados'}`
                : 'esperando un mando'}
            </p>
            <p className="text-xs text-ink-4">{desktopCapture ? 'Sony y Nintendo identificables; Xbox y XInput se excluyen en esta PC.' : `enviando entradas al virtual ${currentSlotMeta.name}`}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-ink-4">muestreo</span>
            <strong className="font-mono text-[13px] font-medium tabular text-ink-1">
              {pollingHz} Hz
            </strong>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-ink-4">slot</span>
            <strong className="font-mono text-[13px] font-medium tabular" style={{ color: accentColor }}>
              {currentSlotMeta.name}
            </strong>
          </div>
        </div>
      </div>

      {connectedGamepads.length === 0 ? (
        <div className="empty-state flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-warning">
            <AlertCircle size={24} aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2>Ningún mando físico detectado</h2>
            <p className="mx-auto max-w-md text-xs leading-relaxed text-ink-3">
              {desktopCapture
                ? 'Conectá un mando Sony o Nintendo identificable y presioná un botón. Los mandos Xbox, XInput y desconocidos se excluyen para evitar realimentación; usá un dispositivo remoto para ellos.'
                : 'Conectá el mando por Bluetooth o USB y presioná cualquier botón para que el navegador lo inicialice.'}
            </p>
          </div>
          <button type="button" onClick={onRefreshGamepads} className={BTN}>
            <Plus size={15} aria-hidden="true" />
            <span>Detectar mandos</span>
          </button>
          <div className="w-48 opacity-40">
            <ControllerImage brand="xbox" />
          </div>
          <p className="max-w-lg border-t border-line pt-4 text-xs leading-relaxed text-ink-4">
            {desktopCapture
              ? 'La captura local depende de que Windows identifique el mando como Sony o Nintendo; Xbox, XInput y mandos desconocidos no se capturan en la aplicación de PC.'
              : 'Compatible con mandos oficiales de Xbox Series X|S, PS5 DualSense, PS4 DualShock, Nintendo Switch Pro y gamepads XInput o DirectInput.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Section
            title="Dispositivos"
            description={
              hardwareEmulated === false
                ? 'Asigná cada mando a un slot virtual. Modo fallback: la PC todavía no recibe un mando virtual.'
                : 'Asigná cada mando a un slot virtual. La PC los ve como mandos Xbox 360.'
            }
            className="lg:col-span-2"
          >
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {connectedGamepads.map((gp) => {
                const isSelected = gp.index === selectedGamepadIndex;
                const assignedSlot = slotMap[gamepadSlotKey(gp)];
                return (
                  <li
                    key={gp.index}
                    className={`overflow-hidden rounded-2xl transition-colors ${
                      isSelected
                        ? 'bg-accent-soft ring-1 ring-accent-line'
                        : 'bg-surface-2'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectGamepad(gp.index)}
                      aria-pressed={isSelected}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/85 p-1.5">
                          <ControllerImage
                            brand={gp.brand}
                            theme={gp.brand === 'sony' ? 'light' : 'dark'}
                            className="h-full w-full object-contain"
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink-1">
                            {gp.name}
                          </span>
                          <span className="block font-mono text-[11px] uppercase tracking-wider text-ink-4">
                            index #{gp.index} · {gp.brand}
                          </span>
                        </span>
                      </span>
                      {isSelected && (
                        <span className="shrink-0 rounded-full bg-ink-1 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-canvas">
                          activo
                        </span>
                      )}
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 px-4 py-2">
                      <span className="text-xs text-ink-4">
                        PC: {pcDeviceLabel} ·{' '}
                        {assignedSlot !== undefined ? PLAYER_SLOTS[assignedSlot].name : 'sin slot'}
                      </span>
                      <div className="flex items-center gap-1">
                        {([0, 1, 2, 3] as PlayerSlotType[]).map((slotOption) => {
                          const isAssigned = assignedSlot === slotOption;
                          return (
                            <button
                              key={slotOption}
                              type="button"
                              aria-label={`Asignar ${gp.name} a ${PLAYER_SLOTS[slotOption].name}`}
                              aria-pressed={isAssigned}
                              onClick={() => onAssignSlot(gamepadSlotKey(gp), slotOption)}
                              className={`inline-flex min-h-11 items-center justify-center rounded-full px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent md:min-h-7 ${
                                isAssigned
                                  ? 'bg-ink-1 font-semibold text-canvas'
                                  : 'bg-surface-3 text-ink-3 hover:text-ink-1'
                              }`}
                            >
                              P{slotOption + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Palancas" description="Posición en vivo de los sticks izquierdo y derecho.">
            <div className="flex items-center justify-around py-2">
              <StickRadar
                label="left stick"
                x={state.lx}
                y={state.ly}
                clicked={state.ls}
                color={accentColor}
              />
              <StickRadar label="right stick" x={state.rx} y={state.ry} clicked={state.rs} />
            </div>
          </Section>

          <Section title="Gatillos" description="Recorrido analógico de LT y RT, más los bumpers.">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between pb-1.5 font-mono text-[11px] text-ink-3">
                  <span>LT / L2</span>
                  <span className="tabular">{Math.round(state.lt * 100)}%</span>
                </div>
                <div className="rd-meter" aria-hidden="true">
                  <span style={{ transform: `scaleX(${state.lt})`, backgroundColor: accentColor }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between pb-1.5 font-mono text-[11px] text-ink-3">
                  <span>RT / R2</span>
                  <span className="tabular">{Math.round(state.rt * 100)}%</span>
                </div>
                <div className="rd-meter" aria-hidden="true">
                  <span style={{ transform: `scaleX(${state.rt})` }} />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                {[
                  { label: 'LB / L1', active: state.lb },
                  { label: 'RB / R1', active: state.rb },
                ].map((bumper) => (
                  <span
                    key={bumper.label}
                    className={`flex-1 rounded-full px-3 py-2 text-center text-[11px] font-medium transition-colors ${
                      bumper.active ? 'bg-ink-1 text-canvas' : 'bg-surface-2 text-ink-3'
                    }`}
                  >
                    {bumper.label}
                  </span>
                ))}
              </div>
            </div>
          </Section>

          <Section
            title="Botones"
            description="Cada prompt se ilumina con el botón real del mando."
            className="lg:col-span-2"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { key: 'a', label: 'A / Cruz', active: state.a },
                { key: 'b', label: 'B / Círculo', active: state.b },
                { key: 'x', label: 'X / Cuadrado', active: state.x },
                { key: 'y', label: 'Y / Triángulo', active: state.y },
                { key: 'dpad-up', label: 'D-pad arriba', active: state.dpadUp },
                { key: 'dpad-down', label: 'D-pad abajo', active: state.dpadDown },
                { key: 'dpad-left', label: 'D-pad izq.', active: state.dpadLeft },
                { key: 'dpad-right', label: 'D-pad der.', active: state.dpadRight },
                { key: 'lb', label: 'LB / L1', active: state.lb },
                { key: 'rb', label: 'RB / R1', active: state.rb },
                { key: 'menu', label: 'Start / Menu', active: state.start },
                { key: 'view', label: 'Back / View', active: state.back },
              ].map((btn) => (
                <div
                  key={btn.key}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${
                    btn.active ? 'bg-accent-soft ring-1 ring-accent-line' : 'bg-surface-2'
                  }`}
                >
                  <ButtonPrompt brand={activeBrand} button={btn.key} size={20} />
                  <span
                    className={`truncate text-[11px] ${btn.active ? 'font-semibold text-ink-1' : 'text-ink-3'}`}
                  >
                    {btn.label}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
};
