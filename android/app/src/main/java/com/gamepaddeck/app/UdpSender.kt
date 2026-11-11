package com.gamepaddeck.app

import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.ArrayDeque
import java.util.concurrent.Executors

class UdpSender {
    private var socket: DatagramSocket? = null
    private var targetAddress: InetAddress? = null
    private var targetPort: Int = 9876
    private val executor = Executors.newSingleThreadExecutor()

    private var seq: Int = 0
    private val packetBuffer = ByteArray(36)
    private data class Report(
        val slot: Int, val buttons: Int, val l2: Int, val r2: Int,
        val lx: Int, val ly: Int, val rx: Int, val ry: Int,
        val address: InetAddress, val port: Int
    )
    private class Pending(var report: Report)
    private val queueLock = Any()
    private val pending = ArrayDeque<Pending>()
    private val latestBySlot = arrayOfNulls<Pending>(4)
    private var draining = false
    private var closed = false

    init {
        try {
            socket = DatagramSocket()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun setTarget(host: String, port: Int = 9876) {
        synchronized(queueLock) {
            if (closed) return
            executor.execute {
                try {
                    val address = InetAddress.getByName(host)
                    synchronized(queueLock) {
                        if (!closed) {
                            targetAddress = address
                            targetPort = port
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun sendSlotReport(
        slot: Int,
        buttons: Int,
        l2: Int,
        r2: Int,
        lx: Int,
        ly: Int,
        rx: Int,
        ry: Int
    ) {
        val normalizedSlot = slot.coerceIn(0, 3)
        synchronized(queueLock) {
            if (closed) return
            val addr = targetAddress ?: return
            val report = Report(normalizedSlot, buttons, l2, r2, lx, ly, rx, ry, addr, targetPort)
            val last = latestBySlot[normalizedSlot]
            val previous = last?.report
            if (previous != null && previous.buttons == buttons && previous.l2 == l2 &&
                previous.r2 == r2 && previous.address == addr && previous.port == report.port) {
                last.report = report
            } else {
                val entry = Pending(report)
                pending.addLast(entry)
                latestBySlot[normalizedSlot] = entry
            }
            if (!draining) {
                draining = true
                executor.execute { drainReports() }
            }
        }
    }

    private fun drainReports() {
        while (true) {
            val report = synchronized(queueLock) {
                val entry = pending.pollFirst()
                if (entry == null) {
                    draining = false
                    return
                }
                if (latestBySlot[entry.report.slot] === entry) latestBySlot[entry.report.slot] = null
                entry.report
            }
            try {
                    seq = (seq + 1) and 0xFF

                    // Header
                    packetBuffer[0] = 0xAA.toByte() // Magic
                    packetBuffer[1] = seq.toByte()  // Sequence
                    val activeMask = (1 shl report.slot)
                    packetBuffer[2] = activeMask.toByte()
                    packetBuffer[3] = 0x00.toByte()

                    // Slot offset: 4 + slot * 8
                    val base = 4 + report.slot * 8
                    packetBuffer[base + 0] = (report.buttons and 0xFF).toByte()
                    packetBuffer[base + 1] = ((report.buttons shr 8) and 0xFF).toByte()
                    packetBuffer[base + 2] = (report.l2 and 0xFF).toByte()
                    packetBuffer[base + 3] = (report.r2 and 0xFF).toByte()
                    packetBuffer[base + 4] = report.lx.toByte()
                    packetBuffer[base + 5] = report.ly.toByte()
                    packetBuffer[base + 6] = report.rx.toByte()
                    packetBuffer[base + 7] = report.ry.toByte()

                    val packet = DatagramPacket(packetBuffer, 36, report.address, report.port)
                    socket?.send(packet)
            } catch (e: Exception) {
                // Ignore network hiccups
            }
        }
    }

    fun close() {
        synchronized(queueLock) {
            closed = true
            pending.clear()
            latestBySlot.fill(null)
        }
        try {
            socket?.close()
        } catch (_: Exception) {}
        executor.shutdown()
    }
}
