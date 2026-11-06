package com.catatanku.auto

import android.app.Application
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

class CatatankuApp : Application() {
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.USE_EMULATORS) {
            // 10.0.2.2 = the host machine as seen from the Android emulator
            FirebaseAuth.getInstance().useEmulator("10.0.2.2", 9099)
            FirebaseFirestore.getInstance().useEmulator("10.0.2.2", 8080)
        }
        CaptureStore.init(this)
        Sources.load(this)
        DeviceSync.init(this)
    }
}
