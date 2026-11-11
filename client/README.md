# GamepadDeck Touch & Web Pad (React + TypeScript)

Ultra-fast, ultra-low latency Cyberpunk-style Virtual Touch Gamepad, Gamepad API Bridge, and Multi-Player PC Monitor for GamepadDeck.

## Features

1. **Virtual Touch Gamepad (`TouchGamepad`)**:
   - Dual virtual analog sticks (LS & RS) with circular clamping, deadzone filtering, smooth spring return, and discrete/double-tap L3 & R3 clicks.
   - Classic 8-direction D-Pad (Up, Down, Left, Right + diagonals).
   - Color-coded Xbox/PlayStation Action Buttons: A (Green), B (Red), X (Blue), Y (Yellow).
   - Bumpers (LB & RB) and progressive analog triggers (LT & RT) with 0-100% interactive touch pressure bars.
   - System buttons: Back / Select, Xbox Guide / Home jewel, Start / Menu.
   - Haptic feedback via `navigator.vibrate` on all presses and triggers.

2. **Physical Gamepad Mode (`PhysicalGamepadView`)**:
   - Hardware detection for PlayStation 5 DualSense, PS4 DualShock, Xbox One / Series X|S, Nintendo Switch Pro Controller, and generic gamepads.
   - Real-time `requestAnimationFrame` polling loop at 60 Hz or 120 Hz.
   - Dynamic stick radar visualization and button matrix.

3. **PC Dashboard / Monitor Mode (`PcDashboard`)**:
   - 4-player quad-grid for PC host or Android TV (Slot 1 Blue, Slot 2 Red, Slot 3 Green, Slot 4 Yellow).
   - Live telemetry: stick positions, triggers, active buttons, RTT ping in milliseconds, packet rate.
   - **QR Code Mobile Pairing**: Generates a dynamic QR code for smartphone cameras to instantly connect and play on the local Wi-Fi.

4. **Calibration & Test Mode (`CalibrationModal`)**:
   - Real-time diagnostic tool for checking deadzones, circular stick perimeter, and all 16 buttons.

5. **Networking & Protocols**:
   - Zero-copy binary 36-byte JoyBus / LithiumPad packets (`0xAA` magic byte, rolling sequence, slot mask).
   - Compact 12-byte single-slot packets.
   - JSON protocol fallback for web diagnostics.
   - Sub-millisecond RTT roundtrip measurement.

6. **PWA & Mobile Ergonomics**:
   - `manifest.json` with fullscreen landscape orientation.
   - CSS safe-area inset protection for notches and dynamic islands.
   - Screen WakeLock API integration to prevent display sleep during gameplay.

## Scripts

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Run unit tests (Vitest)
npm test

# Build production bundle to dist/
npm run build
```
