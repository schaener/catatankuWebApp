import { describe, expect, it } from 'vitest';
import { findAmount, findTransferPairs, parseAmount, parseNotification } from './notifParser.js';

// Synthetic notifications modelled on common Indonesian bank / e-wallet wording.
// Replace with real (redacted) samples as they are collected from the companion app.
const n = (appName, text, title = '') => parseNotification({ appName, packageName: '', title, text });

describe('parseAmount', () => {
  it.each([
    ['1.250.000,00', 1250000],
    ['1,250,000.00', 1250000],
    ['50.000', 50000],
    ['50000', 50000],
    ['15rb', 15000],
    ['1,5 jt', 1500000],
    ['100,00', 100],
  ])('%s -> %i', (raw, expected) => expect(parseAmount(raw)).toBe(expected));
});

describe('findAmount', () => {
  it('skips the balance and takes the transaction amount', () => {
    expect(findAmount('Saldo Anda Rp 2.000.000. Transfer masuk Rp 150.000')).toBe(150000);
    expect(findAmount('Pembayaran Rp25.000 berhasil. Sisa saldo: Rp 75.000')).toBe(25000);
  });
  it('returns null without an amount', () => expect(findAmount('Login berhasil dari perangkat baru')).toBeNull());
  it('reads currency-less amounts after a label', () => {
    expect(findAmount('Transfer ke BUDI berhasil. Nominal: 500.000')).toBe(500000);
    expect(findAmount('Transfer sebesar 1.250.000,00 berhasil')).toBe(1250000);
  });
});

describe('parseNotification', () => {
  it('bank debit via QRIS', () => {
    const r = n('BCA mobile', 'Pembayaran QRIS Rp 45.500,00 di KOPI KENANGAN berhasil pada 05/11 14:02');
    expect(r).toMatchObject({ amount: 45500, type: 'expense', place: 'KOPI KENANGAN', category: 'Makanan & Minuman', paymentMethod: 'Debit', isPromo: false, confidence: 'high' });
  });

  it('bank incoming transfer with balance', () => {
    const r = n('BRImo', 'Dana masuk Rp 8.500.000 dari PT NUSANTARA DIGITAL. Saldo Anda Rp 9.120.000', 'Transfer Masuk');
    expect(r).toMatchObject({ amount: 8500000, type: 'income', place: 'PT NUSANTARA DIGITAL', confidence: 'high' });
  });

  it('stops the name at a capitalised amount or keyword', () => {
    expect(n('BCA mobile', 'Transfer ke BUDI SANTOSO Rp 500.000 berhasil').place).toBe('BUDI SANTOSO');
    expect(n('BRImo', 'Kiriman dari ANI WIJAYA Sebesar Rp 75.000 telah diterima').place).toBe('ANI WIJAYA');
  });

  it('bank outgoing transfer to a person', () => {
    const r = n("Livin' by Mandiri", 'Transfer ke BUDI SANTOSO sebesar Rp 250.000 berhasil');
    expect(r).toMatchObject({ amount: 250000, type: 'expense', place: 'BUDI SANTOSO', paymentMethod: 'Transfer' });
  });

  it('e-wallet ride payment', () => {
    const r = n('Gojek', 'Pembayaran GoPay Rp18.000 untuk GoRide berhasil');
    expect(r).toMatchObject({ amount: 18000, type: 'expense', category: 'Transportasi', paymentMethod: 'E-Wallet' });
  });

  it('e-wallet top up is income for the wallet, expense for the bank', () => {
    expect(n('GoPay', 'Top up Rp100.000 berhasil. Saldo GoPay kamu sekarang Rp 120.000').type).toBe('income');
    expect(n('BCA mobile', 'Top Up GoPay Rp 100.000 berhasil').type).toBe('expense');
  });

  it('e-wallet money received', () => {
    const r = n('DANA', 'Kamu terima Rp50.000 dari ANDI PRATAMA');
    expect(r).toMatchObject({ amount: 50000, type: 'income', place: 'ANDI PRATAMA' });
  });

  it('flags promos even though they contain an amount', () => {
    expect(n('ShopeePay', 'Cashback hingga Rp50rb! Yuk belanja pakai ShopeePay hari ini').isPromo).toBe(true);
    expect(n('OVO', 'Dapatkan diskon Rp 20.000 untuk transaksi pertamamu').isPromo).toBe(true);
  });

  it('treats a completed cashback as income, not a promo', () => {
    const r = n('OVO', 'Cashback sebesar Rp 5.000 telah masuk ke OVO Points kamu');
    expect(r).toMatchObject({ amount: 5000, type: 'income', isPromo: false });
  });

  it('marks unclear notifications low confidence', () => {
    expect(n('SeaBank', 'Ada aktivitas Rp 30.000 di akunmu').confidence).toBe('low');
  });

  it('does not let the app name drive the category', () => {
    const r = parseNotification({ appName: 'Shell', packageName: 'com.android.shell', text: 'Transfer ke BUDI SANTOSO sebesar Rp 250.000 berhasil' });
    expect(r.category).toBe('Lainnya');
    expect(n('BCA mobile', 'Pembayaran QRIS Rp 77.000 di SATE KHAS SENAYAN berhasil').category).toBe('Makanan & Minuman');
    expect(n('BCA mobile', 'Pembayaran Rp 50.000 di KONTROL AC JAYA berhasil').category).toBe('Lainnya');
  });

  it('guesses categories from merchant names', () => {
    expect(n('DANA', 'Pembayaran Rp 120.000 ke PLN PRABAYAR berhasil').category).toBe('Tagihan');
    expect(n('BCA mobile', 'Pembayaran QRIS Rp 23.400 di INDOMARET KEMANG berhasil').category).toBe('Belanja');
  });
});

describe('findTransferPairs', () => {
  const item = (id, packageName, type, amount, postedAt) => ({ id, packageName, postedAt, parsed: { amount, type, isPromo: false } });

  it('pairs an outgoing and incoming notification with the same amount close in time', () => {
    const pairs = findTransferPairs([
      item('a', 'com.bca', 'expense', 100000, 1_000_000),
      item('b', 'com.gojek.app', 'income', 100000, 1_060_000),
      item('c', 'com.dana', 'expense', 100000, 1_000_000 + 60 * 60 * 1000),
    ]);
    expect(pairs.get('a')).toBe('b');
    expect(pairs.get('b')).toBe('a');
    expect(pairs.has('c')).toBe(false);
  });

  it('does not pair notifications from the same app', () => {
    const pairs = findTransferPairs([item('a', 'com.bca', 'expense', 5000, 0), item('b', 'com.bca', 'income', 5000, 1000)]);
    expect(pairs.size).toBe(0);
  });
});
