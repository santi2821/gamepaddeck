//! REST API routes for GamepadDeck server.

use crate::gamepad::GamepadManager;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Serialize)]
pub struct ServerStatusResponse {
    pub name: &'static str,
    pub version: &'static str,
    pub driver: &'static str,
    pub hardware_emulated: bool,
    pub lan_ip: Option<String>,
    pub uptime_secs: u64,
    pub total_udp_packets: u64,
    pub total_ws_packets: u64,
}

/// Classify loopback and this host's primary LAN address as local. This is
/// transport priority, not authentication; proxied traffic appears as its proxy.
pub fn is_local_peer(ip: std::net::IpAddr) -> bool {
    ip.is_loopback() || local_ip().and_then(|value| value.parse::<std::net::IpAddr>().ok()) == Some(ip)
}

pub fn local_ip() -> Option<String> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    let ip = socket.local_addr().ok()?.ip();
    if ip.is_loopback() {
        None
    } else {
        Some(ip.to_string())
    }
}

#[derive(Deserialize)]
pub struct RemapRequest {
    pub target_slot: usize,
}

pub async fn get_status(
    State(manager): State<Arc<RwLock<GamepadManager>>>,
) -> impl IntoResponse {
    let mgr = manager.read().await;
    let (udp, ws) = mgr.total_packets();
    Json(ServerStatusResponse {
        name: "GamepadDeck Server",
        version: "0.1.0",
        driver: mgr.driver_name(),
        hardware_emulated: mgr.is_hardware_emulated(),
        lan_ip: local_ip(),
        uptime_secs: mgr.uptime_secs(),
        total_udp_packets: udp,
        total_ws_packets: ws,
    })
}

pub async fn get_slots(
    State(manager): State<Arc<RwLock<GamepadManager>>>,
) -> impl IntoResponse {
    let mgr = manager.read().await;
    let slots = mgr.get_all_slots_telemetry();
    Json(slots)
}

pub async fn get_slot_by_id(
    State(manager): State<Arc<RwLock<GamepadManager>>>,
    Path(slot_id): Path<usize>,
) -> Result<impl IntoResponse, StatusCode> {
    let mgr = manager.read().await;
    if let Some(telemetry) = mgr.get_slot_telemetry(slot_id) {
        Ok(Json(telemetry))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn disconnect_slot(
    State(manager): State<Arc<RwLock<GamepadManager>>>,
    Path(slot_id): Path<usize>,
) -> impl IntoResponse {
    let mut mgr = manager.write().await;
    mgr.disconnect_slot(slot_id);
    StatusCode::OK
}
