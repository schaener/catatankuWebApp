package com.catatanku.auto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CaptureFilterTest {
    private fun captured(title: String, text: String) = CaptureFilter.decide(title, text) as? Decision.Capture
    private fun reason(title: String, text: String) = (CaptureFilter.decide(title, text) as? Decision.Skip)?.reason

    @Test fun acceptsTransactions() {
        assertTrue(captured("Transaksi Berhasil", "Pembayaran QRIS Rp 45.500,00 di KOPI KENANGAN berhasil") != null)
        assertTrue(captured("GoPay", "Kamu terima Rp50.000 dari ANDI") != null)
        assertTrue(captured("", "Pembelian token listrik PLN Rp 100.000 berhasil") != null)
    }

    @Test fun keepsPromosForTheParserToFlag() {
        assertTrue(captured("Promo", "Cashback hingga Rp50rb! Yuk belanja hari ini") != null)
    }

    /** The bug: security footers made whole transfer notifications disappear. */
    @Test fun keepsTransfersWithSecurityWarningsButStripsTheWarning() {
        val c = captured("Transfer Berhasil", "Transfer ke BUDI SANTOSO Rp 500.000 berhasil. Jangan berikan PIN & OTP kepada siapapun. No. Ref: 12345678")!!
        assertEquals("Transfer ke BUDI SANTOSO Rp 500.000 berhasil. No. Ref: 12345678", c.text)
        assertFalse(c.text.contains("OTP"))
        assertTrue(captured("m-Transfer", "Dana Rp 250.000 terkirim ke ANI. Waspada penipuan, BCA tidak pernah meminta password Anda.") != null)
    }

    @Test fun readsAmountsWithoutCurrency() {
        assertTrue(captured("Transfer Keluar", "Transfer ke BUDI berhasil. Nominal: 500.000") != null)
        assertEquals(500_000L, CaptureFilter.findAmount("Nominal: 500.000"))
    }

    @Test fun pinTokenNumbersAreNotSecrets() {
        assertTrue(captured("PLN", "Pembelian token Rp 100.000 berhasil. Token: 1234-5678-9012-3456-7890") != null)
    }

    @Test fun neverUploadsCodes() {
        assertEquals(SkipReason.SECRET, reason("BCA", "Kode OTP 123456 untuk transaksi Rp 500.000. Jangan berikan kode ini ke siapapun"))
        assertEquals(SkipReason.SECRET, reason("DANA", "Kode verifikasi kamu 4821 untuk top up Rp100.000"))
        assertEquals(SkipReason.SECRET, reason("Bank", "OTP untuk transfer Rp 500.000 ke BUDI: 731942"))
        assertEquals(SkipReason.SECRET, reason("Bank", "482913 adalah kode verifikasi transfer Rp 1.000.000"))
        // a PIN prompt carries the amount only inside the security sentence
        assertEquals(SkipReason.SECRET, reason("Bank", "Masukkan m-PIN untuk transfer Rp 1.000.000"))
    }

    @Test fun explainsOtherSkips() {
        assertEquals(SkipReason.NO_AMOUNT, reason("Login", "Akun kamu masuk dari perangkat baru"))
        assertEquals(SkipReason.HIDDEN, reason("BCA mobile", "Sensitive notification content hidden"))
    }

    @Test fun parsesAmountForDisplay() {
        assertEquals(1250000L, CaptureFilter.findAmount("Transfer Rp 1.250.000,00 berhasil"))
        assertEquals(18000L, CaptureFilter.findAmount("Pembayaran GoPay Rp18.000"))
        assertEquals(1250000L, CaptureFilter.findAmount("IDR 1,250,000.00"))
    }

    @Test fun joinsNotificationParts() {
        assertEquals("Transfer Rp 50.000 berhasil · BCA", NotificationText.join(listOf(" Transfer  Rp 50.000 berhasil ", "Transfer Rp 50.000", "BCA", "")))
    }

    @Test fun stableIds() {
        val a = CaptureFilter.idFor("com.bca", "k1", "t", "x")
        assertEquals(a, CaptureFilter.idFor("com.bca", "k1", "t", "x"))
        assertNotEquals(a, CaptureFilter.idFor("com.bca", "k1", "t", "y"))
    }
}
