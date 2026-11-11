//! mDNS / Bonjour service advertisement for zero-config auto-discovery.

use mdns_sd::{ServiceDaemon, ServiceInfo};
use std::collections::HashMap;

pub struct MdnsAdvertiser {
    daemon: Option<ServiceDaemon>,
}

impl MdnsAdvertiser {
    pub fn new() -> Self {
        Self { daemon: None }
    }

    /// Starts advertising `_lithiumpad._udp` and `_gamepaddeck._udp` on the given port.
    pub fn start(&mut self, udp_port: u16, http_port: u16) -> Result<(), String> {
        let mdns = ServiceDaemon::new().map_err(|e| format!("Failed to create mDNS daemon: {:?}", e))?;

        let hostname = std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| "gamepaddeck-pc".to_string());

        let host_name = format!("{}.local.", hostname);

        let mut properties = HashMap::new();
        properties.insert("version".to_string(), "1.0.0".to_string());
        properties.insert("server".to_string(), "GamepadDeck".to_string());
        properties.insert("http_port".to_string(), http_port.to_string());

        // 1. Announce _lithiumpad._udp.local. (for 100% compatibility with official LithiumPad clients)
        match ServiceInfo::new(
            "_lithiumpad._udp.local.",
            &format!("LithiumPad-{}", hostname),
            &host_name,
            "",
            udp_port,
            properties.clone(),
        ) {
            Ok(service_info) => {
                if let Err(err) = mdns.register(service_info) {
                    tracing::warn!("Failed to register _lithiumpad._udp: {:?}", err);
                } else {
                    tracing::info!("mDNS registered: _lithiumpad._udp.local. on port {}", udp_port);
                }
            }
            Err(e) => tracing::warn!("Failed to build ServiceInfo for _lithiumpad: {:?}", e),
        }

        // 2. Announce _gamepaddeck._udp.local. (for GamepadDeck native clients)
        match ServiceInfo::new(
            "_gamepaddeck._udp.local.",
            &format!("GamepadDeck-{}", hostname),
            &host_name,
            "",
            udp_port,
            properties,
        ) {
            Ok(service_info) => {
                if let Err(err) = mdns.register(service_info) {
                    tracing::warn!("Failed to register _gamepaddeck._udp: {:?}", err);
                } else {
                    tracing::info!("mDNS registered: _gamepaddeck._udp.local. on port {}", udp_port);
                }
            }
            Err(e) => tracing::warn!("Failed to build ServiceInfo for _gamepaddeck: {:?}", e),
        }

        self.daemon = Some(mdns);
        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(daemon) = self.daemon.take() {
            let _ = daemon.shutdown();
        }
    }
}

impl Drop for MdnsAdvertiser {
    fn drop(&mut self) {
        self.stop();
    }
}
