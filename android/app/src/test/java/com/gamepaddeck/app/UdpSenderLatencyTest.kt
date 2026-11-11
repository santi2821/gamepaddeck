package com.gamepaddeck.app

import org.junit.Assert.*
import org.junit.Test
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class UdpSenderLatencyTest {
    @Test
    fun stalledSendDoesNotBuildAnAnalogBacklogOrLoseButtonTransitions() {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val sent = Collections.synchronizedList(mutableListOf<ByteArray>())
        val socket = object : DatagramSocket() {
            override fun send(packet: DatagramPacket) {
                if (entered.count > 0) {
                    entered.countDown()
                    check(release.await(5, TimeUnit.SECONDS))
                }
                sent.add(packet.data.copyOfRange(packet.offset, packet.offset + packet.length))
            }
        }
        val sender = UdpSender()
        fun setField(name: String, value: Any) {
            val field = UdpSender::class.java.getDeclaredField(name)
            field.isAccessible = true
            field.set(sender, value)
        }
        val originalSocket = UdpSender::class.java.getDeclaredField("socket").apply { isAccessible = true }.get(sender) as DatagramSocket
        originalSocket.close()
        setField("socket", socket)
        setField("targetAddress", InetAddress.getLoopbackAddress())
        try {
            sender.sendSlotReport(0, 0, 0, 0, 0, 0, 0, 0)
            assertTrue(entered.await(2, TimeUnit.SECONDS))
            for (x in 1..1000) sender.sendSlotReport(0, 0, 0, 0, x % 40, 0, 0, 0)
            sender.sendSlotReport(0, 0x1000, 0, 0, 42, 0, 0, 0)
            sender.sendSlotReport(0, 0, 0, 0, 43, 0, 0, 0)
            release.countDown()
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3)
            while (System.nanoTime() < deadline && synchronized(sent) {
                    sent.none { (it[8].toInt() and 0xff) == 43 }
                }) Thread.yield()
            val snapshot = synchronized(sent) { sent.toList() }
            assertTrue("latest state was not sent", snapshot.any { (it[8].toInt() and 0xff) == 43 })
            assertTrue("stale analog reports delayed the latest state: ${snapshot.size}", snapshot.size <= 5)
            assertTrue("button press was lost", snapshot.any { (it[5].toInt() and 0xff) == 0x10 })
            assertEquals("button release was lost", 0, snapshot.last()[5].toInt())
        } finally {
            release.countDown()
            sender.close()
        }
    }
}
