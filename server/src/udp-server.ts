import dgram from "node:dgram";
import { GamepadManager } from "./gamepad-manager.js";
import { Packet, PACKET_LEN } from "./protocol.js";

export class UdpServer {
  private socket: dgram.Socket;
  private manager: GamepadManager;
  private port: number;

  constructor(port: number, manager: GamepadManager) {
    this.port = port;
    this.manager = manager;
    this.socket = dgram.createSocket("udp4");

    this.socket.on("message", (msg, rinfo) => {
      if (msg.length === PACKET_LEN) {
        try {
          const packet = Packet.parse(msg);
          this.manager.handlePacket(packet, `${rinfo.address}:${rinfo.port}`);
        } catch {}
      }
    });

    this.socket.on("error", (err) => {
      console.error("[UDP] Socket error:", err);
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.socket.bind(this.port, () => {
        console.log(`[UDP] Gamepad listener active on port ${this.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.socket.close(() => resolve());
    });
  }
}
