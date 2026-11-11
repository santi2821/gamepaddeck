import { GamepadManager } from "./gamepad-manager.js";
import { UdpServer } from "./udp-server.js";
import { WebServer } from "./web-server.js";

const UDP_PORT = parseInt(process.env.UDP_PORT || "9876", 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "8765", 10);

async function main() {
  console.log("==================================================");
  console.log("   GamepadDeck PC Server & Gamepad Engine (Node)  ");
  console.log("==================================================");

  const manager = new GamepadManager();
  console.log(`[Engine] Gamepad driver: ${manager.getDriverInfo().driver}`);

  const udpServer = new UdpServer(UDP_PORT, manager);
  await udpServer.start();

  const webServer = new WebServer(HTTP_PORT, manager);
  await webServer.start();

  // Metrics interval (500ms)
  const metricsTimer = setInterval(() => {
    manager.tickMetrics(5);
  }, 500);

  console.log(`[Status] All services online!`);
  console.log(`- LithiumPad UDP Listener: port ${UDP_PORT}`);
  console.log(`- Web Dashboard & WebSocket: http://localhost:${HTTP_PORT}`);

  const shutdown = async () => {
    console.log("\nShutting down GamepadDeck server...");
    clearInterval(metricsTimer);
    await udpServer.stop();
    await webServer.stop();
    console.log("Exited cleanly.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
