package com.catatanku.auto

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.launch

/**
 * The whole UI is the web app (BuildConfig.WEB_URL) in a WebView, so features ship with a web deploy.
 * Native code is limited to what a browser can't do: reading notifications, phone permissions and
 * Google sign-in, exposed through [WebBridge].
 */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var bridge: WebBridge
    private lateinit var offline: View
    private val origin = Uri.parse(BuildConfig.WEB_URL).let { "${it.scheme}://${it.authority}" }
    private var insetsJs = ""

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // light icons over the teal headers; dark icons over the white tab bar
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = true
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        webView = WebView(this).apply {
            setBackgroundColor(getColor(R.color.bg))
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true // localStorage + IndexedDB: Firestore offline cache, RTK cache
                cacheMode = WebSettings.LOAD_DEFAULT
                setSupportZoom(false)
                mediaPlaybackRequiresUserGesture = true
                allowFileAccess = false
                allowContentAccess = false
                userAgentString = "$userAgentString CatatankuApp/${BuildConfig.VERSION_NAME}"
            }
            webChromeClient = WebChromeClient()
            webViewClient = Client()
        }
        bridge = WebBridge(this, webView, origin)
        webView.addJavascriptInterface(bridge, WebBridge.NAME)
        offline = offlineView()

        val root = FrameLayout(this).apply {
            setBackgroundColor(getColor(R.color.brand))
            addView(webView, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            addView(offline, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        }
        setContentView(root)

        // Edge-to-edge (forced on Android 15): the page draws under the bars and pads itself with these
        // values (CSS --safe-top / --safe-bottom), so headers can stay teal behind the status bar.
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val d = resources.displayMetrics.density
            webView.setPadding(0, 0, 0, ime.bottom) // keyboard pushes content up (sheets with inputs)
            insetsJs = "(function(s){if(!s)return;s.setProperty('--safe-top','${bars.top / d}px');" +
                "s.setProperty('--safe-bottom','${if (ime.bottom > 0) 0f else bars.bottom / d}px');})(document.documentElement&&document.documentElement.style)"
            webView.evaluateJavascript(insetsJs, null)
            insets
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState != null) webView.restoreState(savedInstanceState) else webView.loadUrl(BuildConfig.WEB_URL)

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch { merge(CaptureStore.items.drop(1), SkipLog.items.drop(1)).collect { bridge.emit("native:captured") } }
                // selection changed from another device / the web on another phone
                launch { Sources.selected.drop(1).collect { bridge.emit("native:sources") } }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        CaptureStore.flush(this)
        DeviceSync.publish()
        bridge.emit("native:resume")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    private inner class Client : WebViewClient() {
        /** Our own pages stay in the app; anything else (wa.me, Google Maps, ...) opens externally. */
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url
            if ("${url.scheme}://${url.authority}" == origin) return false
            runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
            return true
        }

        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
            bridge.currentOrigin = url?.let { Uri.parse(it) }?.let { "${it.scheme}://${it.authority}" } ?: ""
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
            bridge.currentOrigin = url?.let { Uri.parse(it) }?.let { "${it.scheme}://${it.authority}" } ?: ""
        }

        override fun onPageFinished(view: WebView, url: String?) {
            if (insetsJs.isNotEmpty()) view.evaluateJavascript(insetsJs, null)
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) offline.visibility = View.VISIBLE
        }
    }

    /** Shown only if the very first load fails (no network and nothing cached yet). */
    private fun offlineView(): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(getColor(R.color.bg))
        setPadding(64, 64, 64, 64)
        visibility = View.GONE
        addView(TextView(context).apply {
            text = "Tidak ada koneksi"
            textSize = 20f
            setTextColor(Color.parseColor("#0B1F1D"))
            gravity = Gravity.CENTER
        })
        addView(TextView(context).apply {
            text = "Notifikasi tetap dicatat dan dikirim otomatis saat online.\nSambungkan internet untuk membuka aplikasi."
            setTextColor(Color.parseColor("#64748B"))
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 40)
        })
        addView(Button(context).apply {
            text = "Coba lagi"
            setOnClickListener {
                offline.visibility = View.GONE
                webView.reload()
            }
        }, LinearLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT))
    }
}
