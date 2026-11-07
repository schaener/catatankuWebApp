plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

// `./gradlew assembleDebug -Pemulators=true` builds a variant that talks to the local Firebase
// Auth/Firestore emulators and loads the web app from the Vite dev server (10.0.2.2 = the host Mac),
// with a fake Google sign-in, for testing on an AVD. `-PwebUrl=...` overrides the web app URL.
val useEmulators = (project.findProperty("emulators") as String?) == "true"
val webUrl = (project.findProperty("webUrl") as String?)
    ?: if (useEmulators) "http://10.0.2.2:5173" else "https://catatanku-fe332.web.app"

android {
    namespace = "com.catatanku.auto"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.catatanku.auto"
        minSdk = 26
        targetSdk = 35
        versionCode = 6
        versionName = "3.1"
        buildConfigField("boolean", "USE_EMULATORS", useEmulators.toString())
        buildConfigField("String", "WEB_URL", "\"$webUrl\"")
        // the local emulators speak plain HTTP
        manifestPlaceholders["cleartext"] = useEmulators.toString()
    }

    buildTypes {
        release {
            // R8: smaller APK and faster startup, which matters most on low-end phones.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    // No Compose: the UI is the web app in a WebView, which keeps the APK small and cold start fast on old phones.
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.0")
    implementation("androidx.webkit:webkit:1.13.0")

    implementation(platform("com.google.firebase:firebase-bom:33.14.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")

    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")

    testImplementation("junit:junit:4.13.2")
}
