//! High-performance Tokio UDP listener for LithiumPad / GamepadDeck packets.

use crate::gamepad::GamepadManager;
use crate::protocol::{Packet, PACKET_LEN};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::RwLock;

pub struct UdpServer {
    bind_addr: SocketAddr,
    manager: Arc<RwLock<GamepadManager>>,
}

impl UdpServer {
    pub fn new(bind_addr: SocketAddr, manager: Arc<RwLock<GamepadManager>>) -> Self {
        Self { bind_addr, manager }
    }

    pub async fn run(self, mut shutdown_rx: tokio::sync::broadcast::Receiver<()>) -> Result<(), std::io::Error> {
        let socket = UdpSocket::bind(self.bind_addr).await?;
        tracing::info!("UDP Gamepad listener active on {}", self.bind_addr);

        let mut buf = [0u8; 1024];
        let local_ip = crate::web::routes::local_ip().and_then(|s| s.parse::<std::net::IpAddr>().ok());

        loop {
            tokio::select! {
                res = socket.recv_from(&mut buf) => {
                    match res {
                        Ok((n, peer_addr)) => {
                            if n == PACKET_LEN {
                                match Packet::parse(&buf[..PACKET_LEN]) {
                                    Ok(packet) => {
                                        let scope = if peer_addr.ip().is_loopback() || Some(peer_addr.ip()) == local_ip { "local" } else { "remote" };
                                        let peer_str = format!("{scope} UDP {peer_addr}");
                                        let mut mgr = self.manager.write().await;
                                        mgr.handle_packet(&packet, Some(&peer_str));
                                    }
                                    Err(err) => {
                                        tracing::trace!(peer = %peer_addr, "Malformed packet: {:?}", err);
                                    }
                                }
                            } else {
                                tracing::trace!(peer = %peer_addr, len = n, "Discarded non-36-byte UDP packet");
                            }
                        }
                        Err(e) => {
                            tracing::error!("UDP recv_from error: {:?}", e);
                        }
                    }
                }
                _ = shutdown_rx.recv() => {
                    tracing::info!("Shutting down UDP Gamepad listener...");
                    break;
                }
            }
        }

        Ok(())
    }
}
