use gamepaddeck_server::{
    gamepad::GamepadManager,
    network::{MdnsAdvertiser, UdpServer},
    web::WebServer,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Spawn GamepadDeck Background Core in a dedicated thread with a multi-threaded Tokio runtime
            std::thread::Builder::new()
                .name("gamepaddeck-server-core".into())
                .spawn(move || {
                    let rt = match tokio::runtime::Builder::new_multi_thread()
                        .enable_all()
                        .build()
                    {
                        Ok(r) => r,
                        Err(e) => {
                            eprintln!("Failed to create Tokio runtime: {}", e);
                            return;
                        }
                    };

                    rt.block_on(async move {
                        let udp_port = 9876u16;
                        let http_port = 8765u16;

                        // 1. Initialize Gamepad Engine (ViGEmBus with fallback)
                        let manager = Arc::new(RwLock::new(GamepadManager::new(false)));
                        let driver_name = manager.read().await.driver_name();
                        println!("Tauri Desktop: Gamepad Manager initialized with driver: {}", driver_name);

                        // 2. Start mDNS discovery
                        let mut mdns = MdnsAdvertiser::new();
                        let _ = mdns.start(udp_port, http_port);

                        // 3. Broadcast shutdown channel
                        let (shutdown_tx, _) = broadcast::channel::<()>(1);

                        // 4. Metrics & heartbeat task
                        let manager_metrics = manager.clone();
                        let mut metrics_rx = shutdown_tx.subscribe();
                        tokio::spawn(async move {
                            let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));
                            loop {
                                tokio::select! {
                                    _ = interval.tick() => {
                                        let mut mgr = manager_metrics.write().await;
                                        mgr.tick_metrics(5);
                                    }
                                    _ = metrics_rx.recv() => break,
                                }
                            }
                        });

                        // 5. UDP Listener task (port 9876)
                        if let Ok(udp_addr) = format!("0.0.0.0:{}", udp_port).parse::<SocketAddr>() {
                            let udp_server = UdpServer::new(udp_addr, manager.clone());
                            let udp_rx = shutdown_tx.subscribe();
                            tokio::spawn(async move {
                                let _ = udp_server.run(udp_rx).await;
                            });
                        }

                        // 6. HTTP & WebSocket Server task (port 8765)
                        if let Ok(http_addr) = format!("0.0.0.0:{}", http_port).parse::<SocketAddr>() {
                            let web_server = WebServer::new(http_addr, manager.clone());
                            let web_rx = shutdown_tx.subscribe();
                            tokio::spawn(async move {
                                let _ = web_server.run(web_rx).await;
                            });
                        }

                        // Keep core runtime alive
                        let mut keep_alive_rx = shutdown_tx.subscribe();
                        let _ = keep_alive_rx.recv().await;
                    });
                })
                .expect("Failed to spawn gamepaddeck-server-core thread");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
