//! GamepadDeck PC Server & Virtual Gamepad Engine
//! Ultra-low-latency, zero-allocation controller server for Windows PC.

use gamepaddeck_server::{
    gamepad::GamepadManager,
    network::{MdnsAdvertiser, UdpServer},
    web::WebServer,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "gamepaddeck_server=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("==================================================");
    tracing::info!("   GamepadDeck PC Server & Gamepad Engine v0.1.0  ");
    tracing::info!("==================================================");

    // 2. Parse configuration from environment or defaults
    let udp_port: u16 = std::env::var("UDP_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(9876);

    let http_port: u16 = std::env::var("HTTP_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8765);

    let force_fallback = std::env::var("FORCE_FALLBACK").map(|v| v == "1" || v == "true").unwrap_or(false);

    // 3. Initialize Gamepad Engine (ViGEm with fallback)
    let manager = Arc::new(RwLock::new(GamepadManager::new(force_fallback)));
    tracing::info!(
        driver = manager.read().await.driver_name(),
        hardware = manager.read().await.is_hardware_emulated(),
        "Gamepad Manager initialized"
    );

    // 4. Start mDNS advertiser
    let mut mdns = MdnsAdvertiser::new();
    if let Err(e) = mdns.start(udp_port, http_port) {
        tracing::warn!("mDNS discovery start warning: {}", e);
    }

    // 5. Broadcast shutdown channel
    let (shutdown_tx, _) = broadcast::channel::<()>(1);

    // 6. Spawn metrics ticker (computes PPS and cleans up stale slots)
    let manager_for_metrics = manager.clone();
    let mut metrics_shutdown_rx = shutdown_tx.subscribe();
    let metrics_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    let mut mgr = manager_for_metrics.write().await;
                    mgr.tick_metrics(5); // Inactivity timeout 5 seconds
                }
                _ = metrics_shutdown_rx.recv() => break,
            }
        }
    });

    // 7. Spawn UDP listener
    let udp_addr: SocketAddr = format!("0.0.0.0:{}", udp_port).parse()?;
    let udp_server = UdpServer::new(udp_addr, manager.clone());
    let udp_shutdown_rx = shutdown_tx.subscribe();
    let udp_task = tokio::spawn(async move {
        if let Err(e) = udp_server.run(udp_shutdown_rx).await {
            tracing::error!("UDP Server encountered error: {:?}", e);
        }
    });

    // 8. Spawn HTTP & WebSocket server
    let http_addr: SocketAddr = format!("0.0.0.0:{}", http_port).parse()?;
    let web_server = WebServer::new(http_addr, manager.clone());
    let web_shutdown_rx = shutdown_tx.subscribe();
    let web_task = tokio::spawn(async move {
        if let Err(e) = web_server.run(web_shutdown_rx).await {
            tracing::error!("Web Server encountered error: {:?}", e);
        }
    });

    tracing::info!("Server fully operational!");
    tracing::info!("- UDP LithiumPad listener: port {}", udp_port);
    tracing::info!("- Web Dashboard & WebSocket: http://localhost:{}", http_port);
    tracing::info!("Press Ctrl+C to terminate server.");

    // Wait for termination signal
    tokio::signal::ctrl_c().await?;
    tracing::info!("Termination signal received. Shutting down gracefully...");

    let _ = shutdown_tx.send(());
    let _ = tokio::join!(metrics_task, udp_task, web_task);
    mdns.stop();

    tracing::info!("GamepadDeck Server exited cleanly.");
    Ok(())
}
