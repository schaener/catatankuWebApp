# Credential Manager loads its Play Services provider reflectively.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }

# Firestore is only used with Maps (no toObject() POJOs), so the library's own consumer rules suffice.

# Keep line numbers for readable crash reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# The web app calls these by name through window.CatatankuNative; R8 must not strip or rename them.
-keepclassmembers class com.catatanku.auto.WebBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
