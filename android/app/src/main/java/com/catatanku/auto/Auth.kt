package com.catatanku.auto

import android.app.Activity
import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
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

    suspend fun signInWithGoogle(activity: Activity) {
        val option = GetSignInWithGoogleOption.Builder(activity.getString(R.string.default_web_client_id)).build()
        val result = CredentialManager.create(activity)
            .getCredential(activity, GetCredentialRequest.Builder().addCredentialOption(option).build())
        val credential = result.credential
        require(credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            "Kredensial Google tidak dikenali"
        }
        val idToken = GoogleIdTokenCredential.createFrom(credential.data).idToken
        finish(activity, auth.signInWithCredential(GoogleAuthProvider.getCredential(idToken, null)).await().user!!)
    }

    /** Emulator builds only: the Auth emulator accepts an unsigned JSON "id token". */
    suspend fun signInFake(context: Context) {
        check(BuildConfig.USE_EMULATORS)
        val token = """{"sub":"tester-1","email":"tester@catatanku.test","email_verified":true,"name":"Penguji Emulator"}"""
        finish(context, auth.signInWithCredential(GoogleAuthProvider.getCredential(token, null)).await().user!!)
    }

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
