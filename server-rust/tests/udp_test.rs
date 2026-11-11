use gamepaddeck_server::{
    gamepad::GamepadManager,
    network::UdpServer,
    protocol::{buttons::*, Packet},
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::{broadcast, RwLock};

#[tokio::test]
async fn test_udp_loopback_integration() {
    let bind_addr: SocketAddr = "127.0.0.1:0".parse().unwrap();
    let listener = UdpSocket::bind(bind_addr).await.unwrap();
    let local_addr = listener.local_addr().unwrap();
    drop(listener); // Free the port so UdpServer can bind it

    let manager = Arc::new(RwLock::new(GamepadManager::new(true)));
    let server = UdpServer::new(local_addr, manager.clone());

    let (shutdown_tx, shutdown_rx) = broadcast::channel(1);
    let server_task = tokio::spawn(async move {
        server.run(shutdown_rx).await.unwrap();
    });

    // Give server a tiny moment to start listening
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;

    // Send valid 36-byte packet from client
    let client_sock = UdpSocket::bind("127.0.0.1:0").await.unwrap();
    let mut pkt = Packet::new(100, 0x01, 0); // Slot 0 active
    pkt.slots[0].buttons = BTN_A | BTN_SHOULDER_L;
    pkt.slots[0].l2 = 180;
    pkt.slots[0].lx = -75;

    let bytes = pkt.to_bytes();
    client_sock.send_to(&bytes, local_addr).await.unwrap();

    // Wait briefly for server processing
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;

    // Check manager state
    {
        let mgr = manager.read().await;
        let slot0 = mgr.get_slot_telemetry(0).expect("Slot 0 missing");
        assert!(slot0.active);
        assert_eq!(slot0.state.buttons, BTN_A | BTN_SHOULDER_L);
        assert_eq!(slot0.state.l2, 180);
        assert_eq!(slot0.state.lx, -75);
        assert_eq!(slot0.packets_received, 1);
    }

    // Send malformed packet (wrong magic)
    let mut bad_pkt = bytes;
    bad_pkt[0] = 0x55;
    client_sock.send_to(&bad_pkt, local_addr).await.unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;

    // Verify slot 0 wasn't altered
    {
        let mgr = manager.read().await;
        let slot0 = mgr.get_slot_telemetry(0).unwrap();
        assert_eq!(slot0.packets_received, 1); // Still 1
    }

    // Shut down cleanly
    let _ = shutdown_tx.send(());
    let _ = server_task.await;
}

#[tokio::test]
async fn local_lan_udp_cannot_override_remote_owner() {
    use gamepaddeck_server::protocol::PadSlot;
    use std::time::Duration;
    let Some(ip) = gamepaddeck_server::web::routes::local_ip() else {
        eprintln!("no LAN address available; remote UDP test skipped");
        return;
    };
    let listener = UdpSocket::bind("0.0.0.0:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    let manager = Arc::new(RwLock::new(GamepadManager::new(true)));
    manager.write().await.handle_single_slot(0, &PadSlot::default(), Some("local WebSocket test"));
    let server = UdpServer::new(([0, 0, 0, 0], port).into(), manager.clone());
    let (shutdown, rx) = broadcast::channel(1);
    let task = tokio::spawn(async move { server.run(rx).await.unwrap() });
    tokio::time::sleep(Duration::from_millis(50)).await;
    let client = UdpSocket::bind((ip.as_str(), 0)).await.unwrap();
    let mut packet = Packet::new(1, 1, 0);
    packet.slots[0].buttons = BTN_X;
    client.send_to(&packet.to_bytes(), (ip.as_str(), port)).await.unwrap();
    tokio::time::sleep(Duration::from_millis(50)).await;
    {
        let mut mgr = manager.write().await;
        let state = mgr.get_slot_telemetry(0).unwrap();
        assert_eq!(state.source.as_deref(), Some("local WebSocket test"));
        assert_eq!(state.state.buttons, 0);
        mgr.handle_packet(&packet, Some("remote UDP phone:1"));
        assert_eq!(mgr.get_slot_telemetry(0).unwrap().state.buttons, BTN_X);
    }
    client.send_to(&Packet::new(2, 1, 0).to_bytes(), (ip.as_str(), port)).await.unwrap();
    tokio::time::sleep(Duration::from_millis(30)).await;
    assert_eq!(manager.read().await.get_slot_telemetry(0).unwrap().state.buttons, BTN_X);
    let _ = shutdown.send(());
    task.await.unwrap();
}
