/**
 * Bridge to the Android shell (android/app/src/main/java/com/catatanku/auto/WebBridge.kt).
 *
 * The APK only does what a browser can't: read notifications, manage phone permissions and run the
 * native Google sign-in (Google blocks OAuth popups inside WebViews). Everything else is this web app,
 * so features ship with a web deploy, without a new APK.
 *
 * Contract (keep in sync with WebBridge.kt). Sync methods return JSON strings; async ones take a
 * callback id and answer through window.__nativeResolve(id, value, error).
 * Events from the shell arrive as window CustomEvents: 'native:resume', 'native:captured', 'native:sources'.
 */
const bridge = typeof window !== 'undefined' ? window.CatatankuNative : undefined;

export const isNativeApp = Boolean(bridge);

const parse = (json, fallback) => {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch {
    return fallback;
  }
};

let nextId = 0;
const pending = new Map();
if (isNativeApp) {
  window.__nativeResolve = (id, value, error) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error) p.reject(new Error(error));
    else p.resolve(value);
  };
}

function callAsync(method, ...args) {
  return new Promise((resolve, reject) => {
    const id = String(++nextId);
    pending.set(id, { resolve, reject });
    bridge[method](id, ...args);
  });
}

// App icons: one bridge call each (sync, a few ms), so they load a handful per frame and are cached
// for the session. Avoids a long freeze on old phones when a grid of 100 apps mounts.
const icons = new Map();
const iconQueue = [];
let iconTimer = 0;
function pumpIcons() {
  iconTimer = 0;
  const end = performance.now() + 8;
  while (iconQueue.length && performance.now() < end) {
    const { pkg, resolve } = iconQueue.shift();
    if (!icons.has(pkg)) icons.set(pkg, bridge?.getAppIcon?.(pkg) || '');
    resolve(icons.get(pkg));
  }
  if (iconQueue.length) iconTimer = requestAnimationFrame(pumpIcons);
}

export const native = {
  /** { listener, battery, autostartScreen, sensitiveNeeded, sensitive, sources, appVersion, device } */
  deviceStatus: () => parse(bridge?.getDeviceStatus(), null),
  /** 'listener' | 'battery' | 'autostart' | 'app' */
  openSetting: (target) => bridge?.openSetting(target),
  copySensitiveCommand: () => bridge?.copySensitiveCommand(),
  /** True when this APK can list / switch its sources locally (v3.1+); older shells go through Firestore. */
  hasLocalSources: Boolean(bridge?.getSources),
  /** [{ packageName, label, suggested, on }] installed on this phone. */
  sources: () => parse(bridge?.getSources?.(), []),
  setSources: (packages, on) => bridge?.setSources?.(JSON.stringify(packages), on),
  /** Cached icon data URL, or undefined if not loaded yet. */
  cachedAppIcon: (pkg) => icons.get(pkg),
  /** Resolves with a PNG data URL ('' when unavailable, e.g. in the browser or an older APK). */
  loadAppIcon: (pkg) => {
    if (icons.has(pkg) || !bridge?.getAppIcon) return Promise.resolve(icons.get(pkg) ?? '');
    return new Promise((resolve) => {
      iconQueue.push({ pkg, resolve });
      if (!iconTimer) iconTimer = requestAnimationFrame(pumpIcons);
    });
  },
  /** Bank / e-wallet notifications the phone skipped, with reason. Never uploaded. */
  skipped: () => parse(bridge?.getSkipped(), []),
  removeSkipped: (id) => bridge?.removeSkipped(id),
  clearSkipped: () => bridge?.clearSkipped(),
  /** Local capture journal (what this phone read). */
  captured: () => parse(bridge?.getCaptured(), []),
  postTestNotification: () => bridge?.postTestNotification(),
  flush: () => bridge?.flush(),
  /** Native share sheet / Web Share API. Returns false when neither is available (caller can copy instead). */
  share: (text) => {
    if (bridge) bridge.share(text);
    else if (navigator.share) navigator.share({ text }).catch(() => {});
    else return false;
    return true;
  },
  signOut: () => bridge?.signOut(),
  hasSession: () => Boolean(bridge?.hasSession()),
  /** Native Google sign-in; resolves with a Google ID token usable by Firebase Web. */
  signIn: (silent = false) => callAsync('signIn', silent),
};
