package com.gamepaddeck.app

import org.junit.Test

class UdpSenderLifecycleTest {
    @Test
    fun lateDiscoveryAfterCloseDoesNotThrow() {
        val sender = UdpSender()
        sender.close()
        sender.setTarget("127.0.0.1", 9876)
    }
}
