package com.catatanku.auto

import android.app.Activity
import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await

/** Google sign-in with the same Firebase project as the web app, so captures land in the same account. */
object Auth {
    val auth: FirebaseAuth get() = FirebaseAuth.getInstance()

    val hasSession: Boolean get() = auth.currentUser != null

    /**
     * Native Google sign-in for the web app inside the WebView (Google blocks OAuth there).
     * Signs the native SDK in (so captures upload to the same account) and returns the Google ID token,
     * which Firebase Web accepts via signInWithCredential. `silent` = reuse an authorized account, no UI.
     */
    suspend fun signInForWeb(activity: Activity, silent: Boolean): String {
        val idToken = if (BuildConfig.USE_EMULATORS) FAKE_TOKEN else googleIdToken(activity, silent)
        finish(activity, auth.signInWithCredential(GoogleAuthProvider.getCredential(idToken, null)).await().user!!)
        return idToken
    }

    private suspend fun googleIdToken(activity: Activity, silent: Boolean): String {
        val clientId = activity.getString(R.string.default_web_client_id)
        val option = if (silent) {
            GetGoogleIdOption.Builder().setServerClientId(clientId).setFilterByAuthorizedAccounts(true).setAutoSelectEnabled(true).build()
        } else {
            GetSignInWithGoogleOption.Builder(clientId).build()
        }
        val credential = CredentialManager.create(activity)
            .getCredential(activity, GetCredentialRequest.Builder().addCredentialOption(option).build()).credential
        require(credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            "Kredensial Google tidak dikenali"
        }
        return GoogleIdTokenCredential.createFrom(credential.data).idToken
    }

    /** Emulator builds only: the Auth emulator accepts an unsigned JSON "id token" (web and native alike). */
    private const val FAKE_TOKEN = """{"sub":"tester-1","email":"tester@catatanku.test","email_verified":true,"name":"Penguji Emulator"}"""

    // Keep the public profile in sync like the web app does, then upload anything captured while signed out.
    private suspend fun finish(context: Context, user: FirebaseUser) {
        runCatching {
            FirebaseFirestore.getInstance().collection("users").document(user.uid).set(
                mapOf(
                    "displayName" to (user.displayName ?: user.email),
                    "displayNameLower" to (user.displayName ?: user.email ?: "").lowercase(),
                    "email" to user.email,
                    "photoURL" to user.photoUrl?.toString(),
                    "lastLoginAt" to FieldValue.serverTimestamp(),
                ),
                SetOptions.merge(),
            ).await()
        }
        CaptureStore.flush(context)
    }

    suspend fun signOut(context: Context) {
        auth.signOut()
        runCatching { CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest()) }
    }
}
