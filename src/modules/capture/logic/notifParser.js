/**
 * Turns a captured bank / e-wallet notification into a transaction draft.
 *
 * The Android companion app only captures raw notifications (and drops OTPs
 * and anything without an amount); all parsing lives here so it can be
 * improved with a web deploy, without reinstalling the APK.
 *
 * Generic rules first; per-app tweaks can be added to APP_RULES once real
 * examples have been collected.
 */

const EWALLET = /gopay|gojek|dana|ovo|shopee|linkaja|astrapay|i\.?saku|sakuku|flip|jenius pay|blu ?pay/i;
const BANK = /bca|bri|brimo|mandiri|livin|bni|wondr|jago|seabank|cimb|octo|permata|danamon|btn|bsi|jenius|blu|neobank|allo|superbank|krom|ocbc|uob|maybank|digibank|line bank|hibank|bank/i;

// Strong signals that money actually moved (vs. an ad that happens to contain "Rp").
const DONE = /berhasil|sukses|telah|sudah|diterima|masuk|terkirim|selesai|dibayar|didebet|didebit|dikredit|ditransfer|successful|received|completed|paid/i;
const PROMO = /promo|diskon|voucher|kupon|cashback (?:hingga|s\.?d|sampai|up to)|hingga|s\.d\.|up to|dapatkan|klaim|buruan|yuk|ayo|spesial|penawaran|gratis ongkir|jangan lewatkan|limited|flash sale|min\.? (?:belanja|transaksi)/i;

const INCOME = /(?:transfer|dana|uang|saldo) masuk|diterima|menerima|kamu terima|anda terima|dikredit|kredit|incoming|received|refund|pengembalian dana|cashback (?:sebesar|senilai|rp)|transfer dari|kiriman dari|dari .+ (?:sebesar|rp)/i;
const EXPENSE = /pembayaran|membayar|bayar|dibayar|debit|didebet|didebit|keluar|transfer ke|kirim(?:an)? ke|terkirim|pembelian|beli|tarik tunai|penarikan|qris|purchase|payment|paid|potong/i;
const TOPUP = /top ?-?up|isi saldo/i;

// Short tokens use \b so e.g. "tol" doesn't match "kontrol". Matched against the notification text and
// merchant only: app names ("Shell" from adb, "Livin'") must not leak into the category.
const CATEGORY_RULES = [
  [/gofood|grabfood|shopeefood|resto|restoran|kopi|coffee|cafe|kafe|bakery|makan|warung|mcd|kfc|starbucks|janji jiwa|kenangan|chatime|hokben|pizza|solaria|\bsate\b|bakso|nasi|\bmie\b|ayam|martabak|seblak|geprek|padang|bakmi|soto/i, 'Makanan & Minuman'],
  [/goride|gocar|grabbike|grabcar|\bgrab\b|maxim|ojek|taksi|taxi|bluebird|\bkai\b|\bkrl\b|commuter|\bmrt\b|\blrt\b|transjakarta|\btj\b|busway|\btol\b|parkir|bensin|pertamina|\bshell\b|bp akr|spbu/i, 'Transportasi'],
  [/\bpln\b|listrik|token|pdam|air minum|telkom|indihome|pulsa|paket data|internet|bpjs|tagihan|cicilan|angsuran|asuransi|biznet|first media|myrepublic|iuran/i, 'Tagihan'],
  [/netflix|spotify|youtube|disney|vidio|steam|google play|app store|playstation|cinema|\bxxi\b|\bcgv\b|bioskop|\bgame/i, 'Hiburan'],
  [/apotek|apotik|kimia farma|\bk24\b|guardian|halodoc|klinik|rumah sakit|\brs\b|dokter|alodokter/i, 'Kesehatan'],
  [/indomaret|alfamart|alfamidi|tokopedia|shopee|lazada|blibli|tiktok shop|bukalapak|superindo|hypermart|transmart|giant|lotte|ikea|ace hardware|uniqlo|zalora/i, 'Belanja'],
  [/sekolah|kampus|kuliah|\bspp\b|\bukt\b|kursus|\bles\b|udemy|coursera|ruangguru|zenius/i, 'Pendidikan'],
  [/\bkos\b|\bkost\b|sewa|kontrakan|\bipl\b|apartemen/i, 'Rumah'],
];
const INCOME_CATEGORY_RULES = [
  [/gaji|salary|payroll/i, 'Gaji'],
  [/bonus|thr/i, 'Bonus'],
  [/bunga|dividen|reksa ?dana|saham|investasi|bibit|ajaib|stockbit/i, 'Investasi'],
];

// Per-app overrides, keyed by a regex on the app name / package. Filled in as real formats are collected.
const APP_RULES = [];

/** "Rp 1.250.000,00" | "Rp1,250,000.00" | "IDR 50.000" | "Rp. 15rb" -> 1250000 / 50000 / 15000 */
export function parseAmount(raw) {
  let s = raw.trim().toLowerCase();
  const short = s.match(/^([\d.,]+)\s*(rb|ribu|k|jt|juta)$/);
  if (short) {
    const n = Number(short[1].replace(',', '.'));
    return Math.round(n * (/jt|juta/.test(short[2]) ? 1e6 : 1e3));
  }
  // "1.250.000,00" / "1,250,000.00": a 1-2 digit tail after the last separator is cents
  s = s.replace(/[^\d.,]/g, '').replace(/[.,]\d{1,2}$/, '');
  const n = Number(s.replace(/[.,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// "Rp 50.000" / "IDR 50,000.00" / "15rb", or a currency-less "Nominal: 500.000" (thousands separators required)
const AMOUNT_RE = /(?:rp\.?|idr)\s?([\d][\d.,]*(?:\s?(?:rb|ribu|k|jt|juta)\b)?)|(?:nominal|sebesar|senilai|jumlah|total|amount)\s*:?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/gi;

/** First amount in the text that isn't a balance ("saldo Rp ..."), or null. */
export function findAmount(text) {
  for (const m of text.matchAll(AMOUNT_RE)) {
    const amount = parseAmount(m[1] ?? m[2]);
    const before = text.slice(Math.max(0, m.index - 24), m.index).toLowerCase();
    const isBalance = /(?:saldo|sisa saldo|balance)(?: akhir| anda| kamu| tersedia| efektif)?\s*(?::|adalah|sebesar|menjadi|jadi)?\s*$/.test(before);
    if (amount && !isBalance) return amount;
  }
  return null;
}

// Words that end a merchant / person name. Case-insensitive on purpose ("Rp", "Sebesar"), while the
// name patterns themselves stay case-sensitive (names start with a capital or digit).
const STOP_WORDS = ['sebesar', 'senilai', 'rp', 'idr', 'pada', 'tgl', 'tanggal', 'berhasil', 'telah', 'via', 'dengan', 'ref']
  .map((w) => [...w].map((c) => `[${c}${c.toUpperCase()}]`).join(''))
  .join('|');
const STOP = String.raw`(?=\s+(?:${STOP_WORDS})\b|[.,;\n]|$)`;

const COUNTERPARTY = [
  new RegExp(String.raw`(?:merchant|toko|penerima|tujuan|kepada|to)\s*:?\s+([A-Z0-9][\w&.'\- ]{1,40}?)${STOP}`, 'i'),
  new RegExp(String.raw`\bdi\s+([A-Z0-9][\w&.'\- ]{1,40}?)${STOP}`, ''),
  new RegExp(String.raw`\b(?:ke|untuk)\s+([A-Z0-9][\w&.'\- ]{1,40}?)${STOP}`, ''),
  new RegExp(String.raw`\bdari\s+([A-Z0-9][\w&.'\- ]{1,40}?)${STOP}`, ''),
];

function findCounterparty(text) {
  for (const re of COUNTERPARTY) {
    const m = text.match(re);
    if (m) {
      const name = m[1].trim().replace(/\s+/g, ' ');
      // skip account numbers and generic words
      if (!/^[\dx*\s-]+$/i.test(name) && !/^(rekening|akun|saldo|anda|kamu|nomor)\b/i.test(name)) return name;
    }
  }
  return '';
}

export function guessCategory(type, haystack) {
  const rules = type === 'income' ? INCOME_CATEGORY_RULES : CATEGORY_RULES;
  return rules.find(([re]) => re.test(haystack))?.[1] || 'Lainnya';
}

/**
 * @param {{ appName?: string, packageName?: string, title?: string, text?: string, postedAt?: number }} n
 * @returns {{ amount: number|null, type: 'income'|'expense'|null, place: string, category: string,
 *             paymentMethod: string, isPromo: boolean, confidence: 'high'|'low' }}
 */
export function parseNotification(n) {
  const app = `${n.appName || ''} ${n.packageName || ''}`;
  const body = `${n.title || ''}. ${n.text || ''}`.replace(/\s+/g, ' ').trim();
  const isWallet = EWALLET.test(app);
  const isBank = !isWallet && BANK.test(app);

  const amount = findAmount(body);
  const done = DONE.test(body);
  const isPromo = !amount || (PROMO.test(body) && !done);

  let type = null;
  if (TOPUP.test(body)) type = isWallet ? 'income' : 'expense';
  else if (INCOME.test(body) && !/transfer ke|kirim(?:an)? ke|pembayaran|membayar/i.test(body)) type = 'income';
  else if (EXPENSE.test(body)) type = 'expense';

  const rule = APP_RULES.find(([re]) => re.test(app));
  const result = {
    amount,
    type,
    place: findCounterparty(n.text || body),
    category: 'Lainnya',
    paymentMethod: isWallet ? 'E-Wallet' : isBank ? (/qris|debit|kartu|card|edc/i.test(body) ? 'Debit' : 'Transfer') : '',
    isPromo,
    confidence: amount && type && done && !isPromo ? 'high' : 'low',
    ...(rule ? rule[1](body, n) : {}),
  };
  result.category = guessCategory(result.type, `${body} ${result.place}`);
  // Gojek wallet payments for rides/food: the service name is a better category hint than the merchant
  if (result.type === 'expense' && result.category === 'Lainnya' && /gojek/i.test(app)) result.category = 'Transportasi';
  return result;
}

/**
 * Pairs of drafts that look like moving money between your own accounts
 * (e.g. BCA "keluar Rp50.000" + GoPay "top up Rp50.000" a minute apart).
 * Returns Map(id -> partnerId).
 */
export function findTransferPairs(items, windowMs = 10 * 60 * 1000) {
  const pairs = new Map();
  const drafts = items
    .filter((i) => i.parsed?.amount && i.parsed.type && !i.parsed.isPromo)
    .sort((a, b) => a.postedAt - b.postedAt);
  for (const a of drafts) {
    if (pairs.has(a.id)) continue;
    const b = drafts.find(
      (x) =>
        x.id !== a.id &&
        !pairs.has(x.id) &&
        x.packageName !== a.packageName &&
        x.parsed.amount === a.parsed.amount &&
        x.parsed.type !== a.parsed.type &&
        Math.abs(x.postedAt - a.postedAt) <= windowMs,
    );
    if (b) {
      pairs.set(a.id, b.id);
      pairs.set(b.id, a.id);
    }
  }
  return pairs;
}

export const isWallet = (app) => EWALLET.test(`${app?.name || ''} ${app?.pkg || ''}`);

/** Web-compatible payment method for an account picked by the user (`app = { pkg, name }`). */
export function paymentMethodFor(app) {
  if (!app?.pkg) return '';
  if (app.pkg === 'cash') return 'Tunai';
  return isWallet(app) ? 'E-Wallet' : 'Debit';
}

// Snapshots re-deliver every inbox doc on each change; parse each distinct notification once.
const parseCache = new Map();
const CACHE_MAX = 600;

/** parseNotification, memoized by notification identity + content. */
export function parseCached(n) {
  const key = `${n.id}|${n.packageName}|${n.title}|${n.text}`;
  let hit = parseCache.get(key);
  if (!hit) {
    hit = parseNotification(n);
    if (parseCache.size >= CACHE_MAX) parseCache.delete(parseCache.keys().next().value);
    parseCache.set(key, hit);
  }
  return hit;
}
