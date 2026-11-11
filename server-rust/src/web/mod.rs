pub mod routes;
pub mod static_files;
pub mod ws;

use crate::gamepad::GamepadManager;
use axum::{
    response::Html,
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

pub struct WebServer {
    bind_addr: SocketAddr,
    manager: Arc<RwLock<GamepadManager>>,
}

impl WebServer {
    pub fn new(bind_addr: SocketAddr, manager: Arc<RwLock<GamepadManager>>) -> Self {
        Self { bind_addr, manager }
    }

    pub fn build_router(manager: Arc<RwLock<GamepadManager>>) -> Router {
        let public_path = [
            "public",
            "../public",
            "server-rust/public",
            "../client/dist",
            "client/dist",
            "d:/gamepaddeck/client/dist",
        ]
        .into_iter()
        .find(|p| std::path::Path::new(p).exists());

        let router = Router::new()
            .route("/ws", get(ws::ws_handler))
            .route("/api/status", get(routes::get_status))
            .route("/api/slots", get(routes::get_slots))
            .route("/api/slots/:id", get(routes::get_slot_by_id))
            .route("/api/slots/:id/disconnect", post(routes::disconnect_slot));

        let router = if let Some(path) = public_path {
            router.fallback_service(ServeDir::new(path))
        } else {
            router.route("/", get(|| async { Html(static_files::DASHBOARD_HTML) }))
        };

        router
            .layer(CorsLayer::permissive())
            .with_state(manager)
    }

    pub async fn run(self, mut shutdown_rx: tokio::sync::broadcast::Receiver<()>) -> Result<(), std::io::Error> {
        let app = Self::build_router(self.manager);
        let listener = tokio::net::TcpListener::bind(self.bind_addr).await?;
        tracing::info!("HTTP & WebSocket server running on http://{}", self.bind_addr);

        axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.recv().await;
                tracing::info!("Shutting down HTTP & WebSocket server...");
            })
            .await?;

        Ok(())
    }
}
