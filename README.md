# Catatanku (Catatan Keuangan)

Personal finance app: bank & e-wallet notifications on an Android phone become transactions automatically;
review, reports, manual entries and shared **squads** live in a **React 19 + Redux Toolkit (RTK Query) +
Firebase** web app. The Android APK is a thin shell (notification listener + WebView), so every feature ships
with a web deploy — no new APK.

Live: https://catatanku-fe332.web.app

## Features

| Feature | Route | Module |
| --- | --- | --- |
| Beranda: this month from notifications, per app, review banner, phone setup checklist | `/` | insights |
| Tinjau: confirm / edit / ignore captured notifications, "Catat ke" a squad, transfer-pair detection, promos, phone history + "Tidak dicatat" (skipped, with reason) | `/review` | review |
| Laporan: period chips, keluar / masuk / pindah dana, KPIs, per app, per category, daily/monthly bars, top merchants, day-grouped list with app filter, share | `/insights` | insights |
| Squad: groups (family, couple, housemates, team) with invite codes, "siapa bayar apa", shared report, per-app auto-share | `/squads`, `/join/:code` | squads |
| ＋ Catat / Ubah / Pindahkan ke aplikasi (+ "Ingat" rule) / Kembalikan ke Tinjau / Hapus | sheets everywhere | ledger |
| HP & sumber: phone permissions (Android app), monitored apps per phone | `/device` | capture |
| Transaksi, Cari (date range, CSV), Laporan tersimpan (snapshots, print/PDF) | `/transactions`, `/search`, `/reports` | ledger, insights |
| Split bill, Chat, Feed, Notifikasi | `/split`, `/chat`, `/feed`, `/notifications` | social |

## Caching system (3 layers)

1. **Firestore IndexedDB persistence** (`src/platform/firebase.js`) – `persistentLocalCache` with multi-tab manager.
   Reads work offline, writes are queued and synced when back online.
2. **RTK Query in-memory cache** (`src/platform/api.js`) – every read is cached by endpoint + args,
   kept 5 min after last use, refetched in the background when older than 2 min or on reconnect, and
   invalidated by tag after mutations. Real-time endpoints (chat, feed, comments) keep the cache live via
   `onSnapshot` (`src/platform/stream.js`, auto-retry with backoff) and remove their listeners automatically.
3. **localStorage snapshot** (`src/platform/cachePersistence.js`) – fulfilled queries for transactions, reports,
   split bills and the user directory are saved per user (24h TTL) and rehydrated on load through RTK
   Query's `extractRehydrationInfo`, so a refresh shows data instantly while fresh data loads
   (stale‑while‑revalidate). Cleared on logout.

## Architecture

```
src/
  app/          shell: router, Layout (sidebar on desktop, bottom tabs on phones), module registry, Lainnya
  platform/     foundation every squad builds on: firebase, RTK Query base + streams, cache persistence,
                auth, UI kit (kit.jsx/kit.css, icons), Android bridge (native.js), composer intent, hooks
  modules/      one folder per squad, each with api/ logic/ components/ pages/ + tests
    capture/    raw inbox, notification parser, phones & monitored apps, "Ingat" app rules
    ledger/     unified entry model, live ledger, write commands (save/move/ignore/delete/back to review),
                entry sheets (＋ Catat), transfers, Transaksi & Cari pages
    review/     Tinjau
    insights/   Beranda, Laporan, saved reports
    squads/     groups, invites, members, shared read model, share rules
    social/     feed, chat, notifications, split bill
  demo/         in-browser Firestore/Auth fake + seed data (demo mode only)
tests/          Firestore security-rules tests (emulator)
```

- **Module contract** (`src/platform/module.js`): each module exposes `index.js` (manifest with routes, nav items,
  badges, providers + public hooks/components) and `domain.js` (pure logic, no React/Firebase). The app shell
  builds routes and navigation from `src/app/modules.js`; adding a feature is one line there.
- **Boundaries are tested** (`src/architecture.test.js`): platform never imports modules; modules only import each
  other via `index.js` / `domain.js`; `domain.js` stays pure; no cycles between modules.
- **Cross-module decoupling**: the ledger asks "where can this be shared?" through a context the squads module
  provides (`platform/shareTargets.js`); any module opens the entry editor with an intent
  (`platform/composer.js#openComposer`) handled by the ledger's `ComposerHost`.
- **Reads / writes (CQRS)**: reads are live Firestore streams (null = loading, served from the offline cache first);
  writes are single atomic batches fired without awaiting the server (instant UI, works offline). Squad sharing is
  fan-out-on-write: the owner writes `squads/{id}/entries/{txId}` in the same batch as the transaction.
- **Performance**: route-level code splitting per module; dependency-free SVG/CSS charts on the main screens
  (recharts only loads with a saved-report detail); module-level memoization of the ledger and per-notification
  parse cache; paginated lists.

### Firestore data model

```
users/{uid}                       public profile (directory for chat/split bill)
users/{uid}/transactions/{id}     type, amount, category, place, paymentMethod, note, date(ms)
                                  + from notifications / the Android app: source (notification|app), appPackage,
                                    appName, movedFromPackage/Name, raw (original notification); ignored by the web UI
users/{uid}/transfers/{id}        moves between own accounts (never counted as spending):
                                  amount, fromPackage/Name, toPackage/Name, date, source, raw[]
users/{uid}/meta/appRules         rules[{fromPackage, keyword, toPackage, toName}] ("INDOMARET from GoPay -> DANA")
users/{uid}/meta/shareRules       rules{appPackage: squadId} (default "Catat ke" per app)
squads/{id}                       name, emoji, ownerId, memberUids[], members{uid:{name,photo,role}}, inviteCode
squads/{id}/entries/{txId}        shared read model: ownerUid, ownerName, type, amount, category, place, app, date
squadInvites/{code}               squadId, expiresAt (7 days); readable by code only, managed by the squad owner
users/{uid}/reports/{id}          title, from, to, notes, summary, transactions[]
users/{uid}/inbox/{id}            captured phone notification: packageName, appName, title, text, postedAt, device,
                                  overridePackage/Name (moved to another app before review)
                                  (deleted once reviewed; parsed client-side, not stored)
users/{uid}/devices/{deviceId}    phone running the Android app: name, osVersion, appVersion, lastSeen, listenerEnabled,
                                  batteryUnrestricted, installedApps[{packageName,label,suggested}], selected[packageName]
users/{uid}/notifications/{id}    type (like|comment|message), actorId, actorName, text, postId|chatId,
                                  count (messages), read, updatedAt
splitBills/{id}                   ownerId, memberUids[], participants[], items[], total...
chats/{id}                        members[], memberInfo, lastMessage, updatedAt
chats/{id}/messages/{id}          text, senderId, createdAt
posts/{id}                        text, authorId, likes[], likeCount, commentCount, createdAt
posts/{id}/comments/{id}          text, authorId, createdAt
```

No composite indexes are required (multi-field sorting and the source filter are done client-side). Rules are
covered by `tests/firestore.rules.test.js` (`npm run test:rules`).

### Notifications

Notifications are written by the client that triggers them (no Cloud Functions needed), best-effort after the
like/comment/message itself succeeds:

| Id | Written when |
| --- | --- |
| `like_{postId}_{actorUid}` | someone likes your post (deleted again on unlike) |
| `comment_{commentId}` | someone comments on your post |
| `chat_{chatId}` | someone sends a message in a chat you are in (one doc per chat, `count` increments) |

`firestore.rules` lets other users create/update these only as themselves (`actorId == auth.uid`), unread, and
only for a post you wrote or a chat you both belong to; the actor may delete their own like notification.
Only the owner can read and mark them read. Alerts arrive while the app is open (including a background tab);
true push when the app is closed would need Firebase Cloud Messaging + Cloud Functions (Blaze plan).

## Setup

Requires **Node ≥ 20.19 or ≥ 22.12** (Vite 8). Node 21 fails with
`ERR_INVALID_ARG_VALUE ... styleText`; e.g. `nvm install 22 && nvm use 22`.

1. Create a Firebase project → add a **Web app**.
2. **Authentication → Sign-in method → Google** → enable. Add your domain under *Authorized domains*
   (`localhost` is there by default).
3. **Firestore Database** → create database.
4. Configure env:
   ```bash
   cp .env.example .env.local   # fill in the web app config values
   ```
5. Install & run:
   ```bash
   npm install
   npm run dev
   ```
   On macOS, if Vite fails with `Cannot find native binding ... @rolldown/binding-darwin-arm64`, install the
   missing optional dependency without touching the lockfile:
   ```bash
   npm install --no-save @rolldown/binding-darwin-arm64@$(node -p "require('./node_modules/rolldown/package.json').version")
   ```
6. Deploy security rules, indexes and hosting (`.firebaserc` pins the project `catatanku-fe332`; run
   `firebase use --add` to deploy to your own project instead):
   ```bash
   npm i -g firebase-tools && firebase login
   npm run build
   firebase deploy --only firestore:rules,firestore:indexes,hosting
   ```

## Android app (`android/`)

**Catatanku** (Kotlin, no Compose, ≈1.7 MB release APK, minSdk 26) is a thin native shell:

- `NotificationCaptureService` reads selected bank / e-wallet notifications (all text fields: big text, InboxStyle
  lines, MessagingStyle, sub-text), re-scans the shade when it (re)connects, and gates what may leave the phone in
  `CaptureFilter`: drops notifications that carry a one-time code (keyword next to a 4–8 digit number), strips
  "jangan berikan PIN/OTP" warning sentences, requires an amount (Rp / IDR / "Nominal: 500.000"). Uploads raw text
  to `users/{uid}/inbox` (offline journal, deterministic ids). Skipped bank notifications are kept on the phone only
  with a reason (`SkipLog`), shown in Tinjau → Riwayat.
- Survives reboots (`BootReceiver`, listener rebind, battery exemption, vendor autostart screens). `DeviceSync`
  mirrors monitored apps to `users/{uid}/devices/{id}` (toggled from the web).
- `MainActivity` hosts the web app (`BuildConfig.WEB_URL`) in a WebView, edge-to-edge (insets passed to CSS as
  `--safe-top` / `--safe-bottom`), external links open in the browser, offline fallback on first load.
- `WebBridge` (`window.CatatankuNative`, contract in `src/platform/native.js`): phone status & settings, skipped /
  captured lists, test notification, share sheet, and **native Google sign-in** (Google blocks OAuth in WebViews):
  Credential Manager returns a Google ID token that both the native SDK and Firebase Web sign in with. Every call is
  checked against the web app origin.
- Android 15+ hides notifications it classifies as one-time codes from listeners, and its detector also fires on
  bank reference numbers ("No. Ref: 88123456"). Lift it once over ADB (shown as a setup step, "Salin" copies it):
  `adb shell cmd appops set com.catatanku.auto RECEIVE_SENSITIVE_NOTIFICATIONS allow` (then re-toggle notification
  access or reboot). The app's own filter still drops real OTPs.

Build (JDK 17, Android SDK 35):

```bash
cd android
./gradlew testDebugUnitTest assembleRelease      # -> app/build/outputs/apk/release/app-release.apk
```

The release build is signed with the local debug keystore whose SHA-1 is registered on the Firebase Android app
(`com.catatanku.auto`); building on another machine requires adding that machine's SHA-1
(`./gradlew signingReport`) in Firebase and re-downloading `app/google-services.json`.

End-to-end on an emulator without a Google account:

```bash
firebase emulators:start --only auth,firestore
VITE_USE_EMULATORS=true npx vite --host 0.0.0.0           # web app against the emulators
cd android && ./gradlew assembleDebug -Pemulators=true   # WebView loads http://10.0.2.2:5173, fake sign-in
```
Debug builds also capture `adb shell cmd notification post ...` notifications (source "Shell").

## Demo mode

`npm run dev:demo` runs the app with Firebase swapped for an in-browser fake (`src/demo/`) seeded with
sample data, so no Firebase project or `.env.local` is needed. "Masuk dengan Google" signs in as a sample
user; friends auto-reply in chat and react to your new posts, which also exercises notifications. Data is
kept in `localStorage`. `npm run build:demo` produces a single self-contained file, `dist-demo/catatan-keuangan-demo.html`.

## Scripts

- `npm run dev` – dev server
- `npm run dev:demo` – dev server in demo mode (no Firebase needed)
- `npm run build` – production build to `dist/`
- `npm run build:demo` – self-contained demo build to `dist-demo/`
- `npm test` – unit + architecture tests (parser, ledger summaries, review queue, squads, split bill, module boundaries)
- `npm run test:rules` – Firestore security-rules tests against the emulator
