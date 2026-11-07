/**
 * Entry filters for summaries. Module-level functions so their identity is stable (memo-friendly).
 * `tracked`: from notifications or recorded with ＋ Catat — excludes legacy manual web entries
 * (and split-bill shares), which is what "laporan dari notifikasi" means.
 */
export const tracked = (e) => !e.legacy;
export const everything = null;

export function shareText(label, s, formatIDR) {
  const lines = [
    `📊 Ringkasan Catatanku · ${label}`,
    '',
    `Keluar      : ${formatIDR(s.expense)}`,
    `Masuk       : ${formatIDR(s.income)}`,
    `Pindah dana : ${formatIDR(s.transfer)}`,
    `Transaksi   : ${s.count}`,
  ];
  if (s.byApp.length) lines.push('', 'Per aplikasi:', ...s.byApp.slice(0, 5).map((a) => `• ${a.label}: ${formatIDR(a.value)}`));
  if (s.byCategory.length) lines.push('', 'Per kategori:', ...s.byCategory.slice(0, 5).map((c) => `• ${c.label}: ${formatIDR(c.value)}`));
  return lines.join('\n');
}
