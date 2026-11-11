import React from 'react';
import { haptics } from '../../services/haptics';
import {
  xboxBtnA,
  xboxBtnB,
  xboxBtnX,
  xboxBtnY,
  psBtnCross,
  psBtnCircle,
  psBtnSquare,
  psBtnTriangle,
  switchBtnA,
  switchBtnB,
  switchBtnX,
  switchBtnY,
  type ControllerBrand,
} from '../../assets/controllers';

interface ActionButtonsProps {
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
  onButtonChange: (btn: 'a' | 'b' | 'x' | 'y', pressed: boolean) => void;
  brand?: ControllerBrand | string;
  size?: number;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  a,
  b,
  x,
  y,
  onButtonChange,
  brand = 'xbox',
  size = 150,
}) => {
  const btnSize = Math.round(size * 0.38);
  const radius = Math.round(size * 0.32);

  const getButtonSvg = (pos: 'south' | 'east' | 'west' | 'north'): string => {
    const b = (brand || 'xbox').toLowerCase();
    if (b.includes('sony') || b.includes('playstation') || b.includes('ps5')) {
      switch (pos) {
        case 'south':
          return psBtnCross;
        case 'east':
          return psBtnCircle;
        case 'west':
          return psBtnSquare;
        case 'north':
          return psBtnTriangle;
      }
    }
    if (b.includes('switch') || b.includes('nintendo')) {
      switch (pos) {
        case 'south':
          return switchBtnB;
        case 'east':
          return switchBtnA;
        case 'west':
          return switchBtnY;
        case 'north':
          return switchBtnX;
      }
    }
    // Default Xbox
    switch (pos) {
      case 'south':
        return xboxBtnA;
      case 'east':
        return xboxBtnB;
      case 'west':
        return xboxBtnX;
      case 'north':
        return xboxBtnY;
    }
  };

  const handlePointerDown = (btnKey: 'a' | 'b' | 'x' | 'y') => (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    haptics.buttonPress();
    onButtonChange(btnKey, true);
  };

  const handlePointerUp = (btnKey: 'a' | 'b' | 'x' | 'y') => (e: React.PointerEvent) => {
    e.preventDefault();
    onButtonChange(btnKey, false);
  };

  const renderRealButton = (
    key: 'a' | 'b' | 'x' | 'y',
    pos: 'south' | 'east' | 'west' | 'north',
    pressed: boolean,
    offsetX: number,
    offsetY: number
  ) => {
    const svgSrc = getButtonSvg(pos);

    return (
      <div
        key={key}
        onPointerDown={handlePointerDown(key)}
        onPointerUp={handlePointerUp(key)}
        onPointerCancel={handlePointerUp(key)}
        className="absolute rounded-full cursor-pointer select-none transition-transform duration-75 flex items-center justify-center p-0.5"
        style={{
          width: `${btnSize}px`,
          height: `${btnSize}px`,
          transform: `translate(${offsetX}px, ${offsetY}px) ${pressed ? 'scale(0.88)' : 'scale(1)'}`,
          filter: pressed ? 'brightness(1.25) drop-shadow(0 0 10px rgba(255,255,255,0.4))' : 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
          touchAction: 'none',
        }}
      >
        <img
          src={svgSrc}
          alt={`Button ${key}`}
          className="w-full h-full object-contain pointer-events-none select-none transition-all"
          draggable={false}
        />
      </div>
    );
  };

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        touchAction: 'none',
      }}
    >
      {/* Subtle guide ring in RomDeck style */}
      <div
        className="absolute rounded-full border border-line/30 pointer-events-none"
        style={{
          width: `${radius * 2}px`,
          height: `${radius * 2}px`,
        }}
      />

      {/* Y Button (North) */}
      {renderRealButton('y', 'north', y, 0, -radius)}

      {/* B Button (East) */}
      {renderRealButton('b', 'east', b, radius, 0)}

      {/* A Button (South) */}
      {renderRealButton('a', 'south', a, 0, radius)}

      {/* X Button (West) */}
      {renderRealButton('x', 'west', x, -radius, 0)}
    </div>
  );
};
