# GamepadDeck

GamepadDeck connects phones, browsers, and physical controllers to a PC gamepad server over a local network. The workspace contains the controller interface, Android client, and two server implementations.

## Components

- `client/` — React and TypeScript interface, built with Vite and packaged for desktop with Tauri.
- `android/` — Android client and its bundled web interface.
- `server/` — Node.js server using TypeScript, UDP, and WebSockets.
- `server-rust/` — Rust server with optional ViGEm virtual gamepad support on Windows.
- `public/` — web assets served by the Rust server.

Each component has its own dependencies and commands. For example, start the client with `cd client` and `npm run dev`, or the Node.js server with `cd server` and `npm run dev`.
