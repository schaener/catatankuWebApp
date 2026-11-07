import { useEffect, useState, useSyncExternalStore } from 'react';
import { isNativeApp, native } from './native.js';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Today's date (ms at local midnight); rolls over when the app comes back after midnight. */
export function useToday() {
  const [today, setToday] = useState(startOfToday);
  useEffect(() => {
    const check = () => setToday((t) => (t === startOfToday() ? t : startOfToday()));
    document.addEventListener('visibilitychange', check);
    window.addEventListener('native:resume', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('native:resume', check);
    };
  }, []);
  return today;
}

const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 760px)') : null;
/** True on phone-sized screens (and always inside the Android app). */
export function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      mq?.addEventListener('change', cb);
      return () => mq?.removeEventListener('change', cb);
    },
    () => isNativeApp || Boolean(mq?.matches),
    () => false,
  );
}

/** Phone status from the Android shell, refreshed whenever the app returns to the foreground. */
export function useNativeStatus() {
  const [status, setStatus] = useState(() => (isNativeApp ? native.deviceStatus() : null));
  useEffect(() => {
    if (!isNativeApp) return undefined;
    const refresh = () => setStatus(native.deviceStatus());
    window.addEventListener('native:resume', refresh);
    window.addEventListener('native:sources', refresh);
    return () => {
      window.removeEventListener('native:resume', refresh);
      window.removeEventListener('native:sources', refresh);
    };
  }, []);
  return status;
}

/** Re-reads a native list (skipped / captured) on resume and on 'native:captured'. */
export function useNativeList(read) {
  const [list, setList] = useState(() => (isNativeApp ? read() : []));
  useEffect(() => {
    if (!isNativeApp) return undefined;
    const refresh = () => setList(read());
    window.addEventListener('native:resume', refresh);
    window.addEventListener('native:captured', refresh);
    return () => {
      window.removeEventListener('native:resume', refresh);
      window.removeEventListener('native:captured', refresh);
    };
  }, [read]);
  return [list, () => setList(read())];
}
