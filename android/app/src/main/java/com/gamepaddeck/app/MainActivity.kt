package com.gamepaddeck.app

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val udpSender = UdpSender()
    private var nsdManager: NsdManager? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var currentSlot: Int = 0
    private var discoveredHost: String? = null
    private var discoveredPort: Int = 8765

    private val scanLauncher = registerForActivityResult(ScanContract()) { result ->
        val contents = result.contents
        Log.d("GamepadDeck", "Scan result: $contents")
        if (contents != null) {
            webView.post {
                webView.evaluateJavascript(
                    "window.onQrScanned && window.onQrScanned(${JSONObject.quote(contents)});",
                    null
                )
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // Immersive Sticky Fullscreen
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = true
            settings.allowFileAccessFromFileURLs = true
            settings.allowUniversalAccessFromFileURLs = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    val host = discoveredHost ?: return
                    view?.evaluateJavascript(
                        "window.onServerDiscovered && window.onServerDiscovered('$host', $discoveredPort);",
                        null
                    )
                }
            }
            addJavascriptInterface(WebAppInterface(this@MainActivity), "AndroidGamepad")
        }

        setContentView(webView)

        // Start mDNS discovery for GamepadDeck & LithiumPad servers
        startDiscovery()

        // Load internal assets via official secure WebViewAssetLoader
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
    }

    private fun startDiscovery() {
        nsdManager = getSystemService(Context.NSD_SERVICE) as? NsdManager
        discoveryListener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(regType: String) {}
            override fun onServiceFound(service: NsdServiceInfo) {
                if (service.serviceType.contains("_gamepaddeck") || service.serviceType.contains("_lithiumpad")) {
                    nsdManager?.resolveService(service, object : NsdManager.ResolveListener {
                        override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
                        override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                            val host = serviceInfo.host?.hostAddress ?: return
                            val port = serviceInfo.port
                            val httpPort = serviceInfo.attributes?.get("http_port")
                                ?.toString(Charsets.UTF_8)?.toIntOrNull() ?: 8765
                            discoveredHost = host
                            discoveredPort = httpPort
                            udpSender.setTarget(host, port)
                            runOnUiThread {
                                webView.evaluateJavascript(
                                    "window.onServerDiscovered && window.onServerDiscovered('$host', $httpPort);",
                                    null
                                )
                            }
                        }
                    })
                }
            }
            override fun onDiscoveryStopped(serviceType: String) {}
            override fun onServiceLost(service: NsdServiceInfo) {}
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
        }

        try {
            nsdManager?.discoverServices("_gamepaddeck._udp", NsdManager.PROTOCOL_DNS_SD, discoveryListener)
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            discoveryListener?.let { nsdManager?.stopServiceDiscovery(it) }
        } catch (_: Exception) {}
        udpSender.close()
    }

    // Physical controllers are sent by the WebView Gamepad API over WebSocket.
    // Do not emit a second, partial native UDP report for the same input.

    inner class WebAppInterface(private val context: Context) {
        @JavascriptInterface
        fun setServer(host: String, port: Int) {
            udpSender.setTarget(host, port)
        }

        @JavascriptInterface
        fun scanQr() {
            runOnUiThread {
                scanLauncher.launch(
                    ScanOptions()
                        .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                        .setPrompt("Escaneá el QR que muestra la PC")
                        .setBeepEnabled(false)
                        .setOrientationLocked(false)
                )
            }
        }

        @JavascriptInterface
        fun toast(message: String) {
            runOnUiThread {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun setOrientation(orientation: String) {
            runOnUiThread {
                requestedOrientation =
                    if (orientation == "landscape") {
                        ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    } else {
                        ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    }
            }
        }

        @JavascriptInterface
        fun setSlot(slot: Int) {
            currentSlot = slot.coerceIn(0, 3)
        }

        @JavascriptInterface
        fun sendReport(slot: Int, buttons: Int, l2: Int, r2: Int, lx: Int, ly: Int, rx: Int, ry: Int) {
            udpSender.sendSlotReport(slot, buttons, l2, r2, lx, ly, rx, ry)
        }

        @JavascriptInterface
        fun vibrate(ms: Long) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                    vibratorManager?.defaultVibrator?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(ms)
                }
            } catch (_: Exception) {}
        }
    }
}
