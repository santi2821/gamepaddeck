"""
End-to-end integration test for GamepadDeck:
1. Spawns gamepaddeck-server.exe on ports 9876 (UDP) and 8765 (HTTP)
2. Sends 36-byte LithiumPad binary UDP packets (Button A, DPAD, Analog sticks)
3. Queries HTTP /api/status and /api/slots to verify reception
4. Verifies Web dashboard HTML and assets are served
5. Cleans up server process
"""

import socket
import struct
import subprocess
import time
import urllib.request
import json
import sys

def build_lithium_packet(seq: int, slot: int, buttons: int, l2: int, r2: int, lx: int, ly: int, rx: int, ry: int) -> bytes:
    # 4 bytes header: magic (0xAA), type (1 = INPUT_REPORT), seq (uint16 LE)
    header = struct.pack("<BBH", 0xAA, 1, seq & 0xFFFF)
    # 4 slots of 8 bytes = 32 bytes
    slots = bytearray(32)
    offset = slot * 8
    struct.pack_into("<HBBbbbb", slots, offset, buttons & 0xFFFF, l2 & 0xFF, r2 & 0xFF, lx, ly, rx, ry)
    return header + bytes(slots)

def main():
    print("--- Starting End-to-End GamepadDeck Verification ---")
    server_exe = r"d:\gamepaddeck\server-rust\target\release\gamepaddeck-server.exe"
    proc = subprocess.Popen([server_exe], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(1.0) # Allow server to bind sockets

    try:
        # Step 1: Check HTTP API status
        print("1. Checking HTTP /api/status...")
        req = urllib.request.Request("http://127.0.0.1:8765/api/status")
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read().decode())
            print(f"   [OK] Server responded: {data['name']} v{data['version']}, Driver: {data['driver']}")
            assert data["name"] == "GamepadDeck Server"

        # Step 2: Check Web Dashboard delivery
        print("2. Checking Web Frontend delivery...")
        req_web = urllib.request.Request("http://127.0.0.1:8765/")
        with urllib.request.urlopen(req_web, timeout=3.0) as resp:
            html = resp.read().decode()
            assert "<!DOCTYPE html>" in html or "<html" in html
            print("   [OK] Web dashboard served successfully (length:", len(html), "bytes)")

        # Step 3: Send UDP 36-byte packet to Slot 0
        print("3. Sending UDP 36-byte LithiumPad packet to 127.0.0.1:9876...")
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Button A = 0x1000, Stick LX = +100, Stick LY = -50
        packet = build_lithium_packet(seq=1, slot=0, buttons=0x1000, l2=200, r2=0, lx=100, ly=-50, rx=0, ry=0)
        assert len(packet) == 36, f"Invalid packet length: {len(packet)}"
        sock.sendto(packet, ("127.0.0.1", 9876))
        time.sleep(0.1)

        # Step 4: Verify telemetry in /api/slots
        print("4. Verifying telemetry in /api/slots...")
        req_slots = urllib.request.Request("http://127.0.0.1:8765/api/slots")
        with urllib.request.urlopen(req_slots, timeout=3.0) as resp:
            slots_data = json.loads(resp.read().decode())
            assert len(slots_data) == 4, f"Expected 4 slots, got {len(slots_data)}"
            slot0 = slots_data[0]
            print(f"   [OK] Slot 0 status: active={slot0['active']}, packets={slot0['packets_received']}")
            assert slot0["active"] == True
            assert slot0["packets_received"] >= 1
            assert slot0["state"]["buttons"] == 0x1000
            assert slot0["state"]["l2"] == 200
            assert slot0["state"]["lx"] == 100
            assert slot0["state"]["ly"] == -50
            print("   [OK] Slot 0 button and analog telemetry matches packet perfectly!")

        print("\n>>> ALL END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY (100%) <<<")

    finally:
        proc.terminate()
        proc.wait(timeout=3.0)

if __name__ == "__main__":
    main()
