use futures_util::{SinkExt, StreamExt};
use gamepaddeck_server::{
    gamepad::GamepadManager,
    protocol::buttons::*,
    web::WebServer,
};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

#[tokio::test]
async fn test_ws_loopback_integration() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let local_addr = listener.local_addr().unwrap();
    drop(listener);

    let manager = Arc::new(RwLock::new(GamepadManager::new(true)));
    let server = WebServer::new(local_addr, manager.clone());

    let (shutdown_tx, shutdown_rx) = broadcast::channel(1);
    let server_task = tokio::spawn(async move {
        server.run(shutdown_rx).await.unwrap();
    });

    tokio::time::sleep(std::time::Duration::from_millis(50)).await;

    // Connect WebSocket
    let ws_url = format!("ws://{}/ws", local_addr);
    let (mut ws_stream, _) = connect_async(&ws_url).await.expect("Failed to connect WS");

    // 1. Send Ping
    let ping_msg = serde_json::json!({
        "type": "ping",
        "client_ts": 1700000000000u64,
        "slot": 1
    });
    ws_stream.send(Message::Text(ping_msg.to_string())).await.unwrap();

    // 2. Send Input
    let input_msg = serde_json::json!({
        "type": "input",
        "slot": 1,
        "buttons": BTN_B | BTN_Y,
        "l2": 0,
        "r2": 255,
        "lx": 100,
        "ly": -100,
        "rx": 0,
        "ry": 0,
        "timestamp": 1700000000000u64
    });
    ws_stream.send(Message::Text(input_msg.to_string())).await.unwrap();

    // 3. Receive messages (expecting Pong and/or Telemetry)
    let mut got_pong = false;
    let mut timeout = tokio::time::interval(std::time::Duration::from_millis(100));

    for _ in 0..5 {
        tokio::select! {
            Some(Ok(msg)) = ws_stream.next() => {
                if let Message::Text(text) = msg {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        if val.get("type").and_then(|t| t.as_str()) == Some("pong") {
                            assert_eq!(val.get("client_ts").and_then(|t| t.as_u64()), Some(1700000000000));
                            got_pong = true;
                            break;
                        }
                    }
                }
            }
            _ = timeout.tick() => {}
        }
    }
    assert!(got_pong, "Server did not respond with pong");

    // Verify manager state for Slot 1
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    {
        let mgr = manager.read().await;
        let slot1 = mgr.get_slot_telemetry(1).expect("Slot 1 missing");
        assert!(slot1.active);
        assert_eq!(slot1.state.buttons, BTN_B | BTN_Y);
        assert_eq!(slot1.state.r2, 255);
        assert_eq!(slot1.state.lx, 100);
        assert_eq!(slot1.state.ly, -100);
    }

    // Clean shutdown
    let _ = ws_stream.close(None).await;
    let _ = shutdown_tx.send(());
    let _ = server_task.await;
}

#[tokio::test]
async fn held_button_survives_competing_websocket_and_owner_disconnect() {
    use std::time::Duration;
    use gamepaddeck_server::protocol::Packet;

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);
    let manager = Arc::new(RwLock::new(GamepadManager::new(true)));
    let server = WebServer::new(addr, manager.clone());
    let (shutdown, rx) = broadcast::channel(1);
    let task = tokio::spawn(async move { server.run(rx).await.unwrap() });
    tokio::time::sleep(Duration::from_millis(50)).await;
    let url = format!("ws://{addr}/ws");
    let (mut owner, _) = connect_async(&url).await.unwrap();
    let (mut rival, _) = connect_async(&url).await.unwrap();
    owner.send(Message::Text(serde_json::json!({"type":"controller_meta", "slot":0, "brand":"Sony", "name":"owner"}).to_string())).await.unwrap();
    let mut pressed = Packet::new(1, 1, 0);
    pressed.slots[0].buttons = BTN_X;
    owner.send(Message::Binary(pressed.to_bytes().to_vec())).await.unwrap();
    tokio::time::sleep(Duration::from_millis(30)).await;
    rival.send(Message::Text(serde_json::json!({"type":"controller_meta", "slot":0, "brand":"rival", "name":"wrong"}).to_string())).await.unwrap();
    rival.send(Message::Text(serde_json::json!({"type":"release_slot", "slot":0}).to_string())).await.unwrap();
    for seq in 2..12 {
        let neutral = Packet::new(seq, 1, 0);
        rival.send(Message::Binary(neutral.to_bytes().to_vec())).await.unwrap();
        tokio::time::sleep(Duration::from_millis(5)).await;
        let slot = manager.read().await.get_slot_telemetry(0).unwrap();
        assert_eq!(slot.state.buttons, BTN_X, "rival released held button");
        assert_eq!(slot.meta.unwrap().brand, "Sony", "rival overwrote metadata");
    }
    owner.send(Message::Text(serde_json::json!({"type":"release_slot", "slot":0}).to_string())).await.unwrap();
    tokio::time::sleep(Duration::from_millis(30)).await;
    assert!(!manager.read().await.get_slot_telemetry(0).unwrap().active);
    let mut next = Packet::new(12, 1, 0);
    next.slots[0].buttons = BTN_B;
    rival.send(Message::Binary(next.to_bytes().to_vec())).await.unwrap();
    tokio::time::sleep(Duration::from_millis(30)).await;
    let slot = manager.read().await.get_slot_telemetry(0).unwrap();
    assert_eq!(slot.state.buttons, BTN_B);
    assert_eq!(slot.meta.unwrap().brand, "rival");
    owner.close(None).await.unwrap();
    tokio::time::sleep(Duration::from_millis(30)).await;
    assert_eq!(manager.read().await.get_slot_telemetry(0).unwrap().state.buttons, BTN_B);
    rival.close(None).await.unwrap();
    tokio::time::sleep(Duration::from_millis(30)).await;
    assert!(!manager.read().await.get_slot_telemetry(0).unwrap().active);
    let _ = shutdown.send(());
    task.await.unwrap();
}
