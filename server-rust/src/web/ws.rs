//! Real-time WebSocket handler for Web PWA controller input and live dashboard telemetry.

use crate::gamepad::GamepadManager;
use crate::protocol::{PadSlot, Packet, PACKET_LEN, SINGLE_SLOT_BIN_LEN};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_CONNECTION_ID: AtomicU64 = AtomicU64::new(1);
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ClientWsMessage {
    #[serde(rename = "ping")]
    Ping {
        #[serde(alias = "timestamp", default)]
        client_ts: u64,
        #[serde(default)]
        slot: Option<usize>,
    },
    #[serde(rename = "input")]
    Input {
        slot: usize,
        #[serde(default)]
        buttons: u16,
        #[serde(default)]
        l2: u8,
        #[serde(default)]
        r2: u8,
        #[serde(default)]
        lx: i8,
        #[serde(default)]
        ly: i8,
        #[serde(default)]
        rx: i8,
        #[serde(default)]
        ry: i8,
        #[serde(default)]
        timestamp: Option<u64>,
    },
    #[serde(rename = "controller_meta")]
    ControllerMeta {
        slot: usize,
        #[serde(default)]
        brand: String,
        #[serde(default)]
        name: String,
    },
    #[serde(rename = "release_slot")]
    ReleaseSlot { slot: usize },
    #[serde(rename = "subscribe")]
    Subscribe,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum ServerWsMessage {
    #[serde(rename = "pong")]
    Pong {
        client_ts: u64,
        server_ts: u64,
    },
    #[serde(rename = "server_info")]
    ServerInfo {
        driver: String,
        #[serde(rename = "hardwareEmulated")]
        hardware_emulated: bool,
        #[serde(rename = "lanIp")]
        lan_ip: Option<String>,
    },
    #[serde(rename = "telemetry")]
    Telemetry {
        slots: Vec<crate::gamepad::SlotTelemetry>,
        server_ts: u64,
    },
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(manager): State<Arc<RwLock<GamepadManager>>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, manager, peer))
}

async fn handle_socket(socket: WebSocket, manager: Arc<RwLock<GamepadManager>>, peer: SocketAddr) {
    let scope = if crate::web::routes::is_local_peer(peer.ip()) { "local" } else { "remote" };
    let source = format!("{scope} WebSocket {peer} #{}", NEXT_CONNECTION_ID.fetch_add(1, Ordering::Relaxed));
    let (mut sender, mut receiver) = socket.split();

    // Channel for pushing messages to the client
    let (tx, mut rx) = tokio::sync::mpsc::channel::<Message>(128);

    // Sender task
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Announce which driver backs the virtual devices so the client can label them
    {
        let mgr = manager.read().await;
        let info = ServerWsMessage::ServerInfo {
            driver: mgr.driver_name().to_string(),
            hardware_emulated: mgr.is_hardware_emulated(),
            lan_ip: crate::web::routes::local_ip(),
        };
        if let Ok(json) = serde_json::to_string(&info) {
            let _ = tx.send(Message::Text(json)).await;
        }
    }

    let manager_for_telemetry = manager.clone();
    let tx_for_telemetry = tx.clone();

    // Telemetry streaming task (30 FPS broadcast to dashboard)
    let telemetry_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(33));
        loop {
            interval.tick().await;
            let epoch_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;

            let slots = {
                let mgr = manager_for_telemetry.read().await;
                mgr.get_all_slots_telemetry()
            };

            let msg = ServerWsMessage::Telemetry {
                slots,
                server_ts: epoch_ms,
            };

            if let Ok(json_str) = serde_json::to_string(&msg) {
                if tx_for_telemetry.send(Message::Text(json_str)).await.is_err() {
                    break;
                }
            }
        }
    });

    // Metadata can precede the first input; keep it per connection until it owns a slot.
    let mut metadata: HashMap<usize, (String, String)> = HashMap::new();

    // Receiver task
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                if let Ok(client_msg) = serde_json::from_str::<ClientWsMessage>(&text) {
                    let now_ms = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;

                    match client_msg {
                        ClientWsMessage::Ping { client_ts, slot } => {
                            if now_ms >= client_ts {
                                let rtt = (now_ms - client_ts) as f32;
                                if let Some(s) = slot {
                                    let mut mgr = manager.write().await;
                                    mgr.update_rtt(s, rtt);
                                }
                            }

                            let pong = ServerWsMessage::Pong {
                                client_ts,
                                server_ts: now_ms,
                            };
                            if let Ok(pong_str) = serde_json::to_string(&pong) {
                                let _ = tx.send(Message::Text(pong_str)).await;
                            }
                        }
                        ClientWsMessage::Input {
                            slot,
                            buttons,
                            l2,
                            r2,
                            lx,
                            ly,
                            rx,
                            ry,
                            timestamp,
                        } => {
                            let pad = PadSlot::new(buttons, l2, r2, lx, ly, rx, ry);
                            let mut mgr = manager.write().await;
                            mgr.handle_single_slot(slot, &pad, Some(&source));
                            if let Some((brand, name)) = metadata.get(&slot) {
                                mgr.set_controller_meta_for_source(slot, &source, brand, name);
                            }

                            if let Some(ts) = timestamp {
                                if now_ms >= ts {
                                    mgr.update_rtt(slot, (now_ms - ts) as f32);
                                }
                            }
                        }
                        ClientWsMessage::ControllerMeta { slot, brand, name } => {
                            if slot < crate::protocol::NUM_SLOTS {
                                let mut mgr = manager.write().await;
                                mgr.set_controller_meta_for_source(slot, &source, &brand, &name);
                                metadata.insert(slot, (brand, name));
                            }
                        }
                        ClientWsMessage::ReleaseSlot { slot } => {
                            if manager.write().await.release_slot_for_source(slot, &source) {
                                metadata.remove(&slot);
                            }
                        }
                        ClientWsMessage::Subscribe => {
                            // Already handled by periodic telemetry loop
                        }
                    }
                }
            }
            Message::Binary(bytes) => {
                if bytes.len() == PACKET_LEN {
                    if let Ok(packet) = Packet::parse(&bytes) {
                        let mut mgr = manager.write().await;
                        mgr.handle_ws_packet(&packet, Some(&source));
                        for (&slot, (brand, name)) in &metadata {
                            if packet.is_slot_active(slot) {
                                mgr.set_controller_meta_for_source(slot, &source, brand, name);
                            }
                        }
                    }
                } else if bytes.len() == SINGLE_SLOT_BIN_LEN {
                    let slot_idx = bytes[0] as usize;
                    let pad = PadSlot::deserialize(&bytes[1..9]);
                    let mut mgr = manager.write().await;
                    mgr.handle_single_slot(slot_idx, &pad, Some(&source));
                    if let Some((brand, name)) = metadata.get(&slot_idx) {
                        mgr.set_controller_meta_for_source(slot_idx, &source, brand, name);
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    manager.write().await.disconnect_source(&source);
    send_task.abort();
    telemetry_task.abort();
}
