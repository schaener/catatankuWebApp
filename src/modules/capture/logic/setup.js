import { native } from '../../../platform/native.js';
import { useNativeStatus } from '../../../platform/hooks.js';

/** Steps that keep capturing alive across reboots; only meaningful inside the Android app.
 * A step has either `run` (native action) or `to` (route in this app). */
function setupSteps(s) {
  if (!s) return [];
  return [
    { title: 'Izinkan akses notifikasi', sub: 'Wajib, supaya notifikasi bank & e-wallet bisa dibaca', done: s.listener, action: 'Izinkan', run: () => native.openSetting('listener') },
    { title: 'Pilih aplikasi sumber', sub: 'Bank & e-wallet yang mau dicatat', done: s.sources > 0, action: 'Pilih', to: '/sources' },
    s.sensitiveNeeded && { title: 'Baca notifikasi bank lengkap', sub: 'Android 15 menyembunyikan notifikasi bernomor referensi. Aktifkan sekali lewat ADB', done: s.sensitive, action: 'Salin', run: native.copySensitiveCommand },
    { title: 'Matikan optimasi baterai', sub: 'Supaya tidak dihentikan sistem di latar belakang', done: s.battery, action: 'Atur', run: () => native.openSetting('battery') },
    s.autostartScreen && { title: 'Izinkan mulai otomatis', sub: 'Xiaomi/Oppo/vivo: aktifkan Catatanku di daftar autostart', done: false, action: 'Buka', run: () => native.openSetting('autostart') },
  ].filter(Boolean);
}

/** { status, steps, missing } for the setup checklist (Home and Pengaturan HP). */
export function useSetupProgress() {
  const status = useNativeStatus();
  const steps = setupSteps(status);
  return { status, steps, missing: steps.filter((s) => !s.done).length };
}

