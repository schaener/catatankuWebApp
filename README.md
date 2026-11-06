# Catatan Keuangan

Personal finance web app built with **React 19 + Redux Toolkit (RTK Query)**, **Firebase Firestore** as the
database and **Google Sign-In** via Firebase Auth.

Live: https://catatanku-fe332.web.app

## Features

| Feature | Where | Notes |
| --- | --- | --- |
| Google login | `/` (when signed out) | Firebase Auth popup, profile synced to `users/{uid}` |
| Dashboard | `/` | Monthly balance, income/expense, 6‑month trend chart, expense by category, **where money is spent** (top places), split-bill receivables |
| Transactions | `/transactions` | Income/expense with category, **place (where spent)**, payment method, note; edit/delete; month navigation; share to feed |
| Search by date range | `/search` | Date range + presets, keyword, type, category, min/max amount, CSV export |
| Reports | `/reports` | Create a frozen snapshot report for any date range: totals, per category/place/method/month, transaction list, print/PDF, CSV |
| Split bill | `/split` | Equal, per‑item, or custom split with tax & service; registered users or guests; mark paid (optimistic); copy summary for WhatsApp; open group chat; optionally log your share as an expense |
| Chat | `/chat` | Real-time direct & group chats between users; unread badge in the sidebar |
| Social feed | `/feed` | Post stories/tips with mood, amount, category, image URL; likes (optimistic), real-time comments, load more |
| Auto-capture review | `/review` | Bank & e-wallet notifications captured by the Android companion app (`android/`) are parsed into drafts (`src/utils/notifParser.js`): amount, income/expense, merchant, category guess, promo detection. Save one / all confident ones, edit in the transaction form, ignore, or confirm a detected **transfer between own accounts** (same amount out of one app and into another within 10 min) so it isn't counted twice. A second tab, **Aplikasi dipantau**, lists every connected phone (status: notification access, battery, last seen) with an on/off switch per installed app, synced live with the phone. Menu item appears once a phone is connected or items are waiting |
| Notifications | `/notifications` | Real-time alerts for likes and comments on your posts and new chat messages (grouped per chat with a count); unread badges, toast while the app is open, browser notification when the tab is hidden, mark read / mark all read. The chat you have open is marked read automatically |

## Caching system (3 layers)

1. **Firestore IndexedDB persistence** (`src/firebase.js`) – `persistentLocalCache` with multi-tab manager.
   Reads work offline, writes are queued and synced when back online.
2. **RTK Query in-memory cache** (`src/services/api.js`) – every read is cached by endpoint + args,
   kept 5 min after last use, refetched in the background when older than 2 min or on reconnect, and
   invalidated by tag after mutations. Real-time endpoints (chat, feed, comments) keep the cache live via
   `onSnapshot` (`src/services/stream.js`) and remove their listeners automatically.
3. **localStorage snapshot** (`src/app/cachePersistence.js`) – fulfilled queries for transactions, reports,
   split bills and the user directory are saved per user (24h TTL) and rehydrated on load through RTK
   Query's `extractRehydrationInfo`, so a refresh shows data instantly while fresh data loads
   (stale‑while‑revalidate). Cleared on logout.

## Project structure

```
src/
  app/            store + cache persistence
  features/auth   auth slice & thunks (Google login, listener)
  features/ui     toasts, shared UI state
  features/notifications  unread counts, toast/browser alerts (useNotifications)
  services/       RTK Query endpoints per domain (transactions, reports, splitBills, chat, posts, users, notifications)
  components/     layout, forms, lists, modal, pickers
  pages/          route pages (lazy-loaded)
  utils/          finance calculations (tested), dates, formatting
  demo/           in-browser Firestore/Auth fake + seed data (demo mode only)
firestore.rules   security rules
```

### Firestore data model

```
users/{uid}                       public profile (directory for chat/split bill)
users/{uid}/transactions/{id}     type, amount, category, place, paymentMethod, note, date(ms)
users/{uid}/reports/{id}          title, from, to, notes, summary, transactions[]
users/{uid}/inbox/{id}            captured phone notification: packageName, appName, title, text, postedAt, device
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

No composite indexes are required (multi-field sorting is done client-side).

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

## Android companion app (`android/`)

**Catatanku Auto** (Kotlin + Jetpack Compose) captures bank / e-wallet notifications on the phone and uploads them
to `users/{uid}/inbox` of the same Firebase account (Google sign-in via Credential Manager).

- `NotificationCaptureService` (NotificationListenerService) handles only apps the user selected (finance apps are
  pre-selected by name), drops anything without an `Rp`/`IDR` amount and anything that looks like an OTP / PIN.
  Parsing happens on the web, so improving it needs no reinstall.
- Survives reboots: the system re-binds the listener once *Notification access* is granted; `BootReceiver`
  additionally requests a rebind and flushes the queue after `BOOT_COMPLETED` / app update. The home screen walks
  the user through notification access, battery optimisation and the vendor autostart screen (Xiaomi, Oppo/realme,
  vivo, Huawei, ...).
- Which apps are captured can be switched on/off on the phone (*Sumber* tab) or on the web (*Tinjau → Aplikasi
  dipantau*). `DeviceSync` mirrors the phone to `users/{uid}/devices/{deviceId}` and listens for changes; the
  listener reads a local copy, so the selection also applies offline and right after a reboot. Bank / e-wallet apps
  installed later are switched on automatically once.
- Offline-safe: captures are journaled locally (`files/captured.json`) and uploaded with deterministic ids when
  online/signed in.
- Android 15+ hides notification content the system classifies as a one-time code ("Sensitive notification content
  hidden"); such notifications can't be read by any third-party listener.

Build (JDK 17, Android SDK 35):

```bash
cd android
./gradlew testDebugUnitTest assembleRelease      # -> app/build/outputs/apk/release/app-release.apk
```

The release build is signed with the local debug keystore whose SHA-1 is registered on the Firebase Android app
(`com.catatanku.auto`); building on another machine requires adding that machine's SHA-1
(`./gradlew signingReport`) in Firebase and re-downloading `app/google-services.json`.

Testing on an emulator without a Google account: `./gradlew assembleDebug -Pemulators=true` builds a variant that
uses the local Auth/Firestore emulators (`firebase emulators:start --only auth,firestore`) and offers a fake sign-in;
debug builds also capture `adb shell cmd notification post ...` notifications.

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
- `npm test` – unit tests for finance logic (split bill math, summaries, filters)
