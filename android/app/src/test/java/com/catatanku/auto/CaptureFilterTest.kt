package com.catatanku.auto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CaptureFilterTest {
    @Test fun acceptsTransactions() {
        assertTrue(CaptureFilter.isCandidate("Transaksi Berhasil", "Pembayaran QRIS Rp 45.500,00 di KOPI KENANGAN berhasil"))
        assertTrue(CaptureFilter.isCandidate("GoPay", "Kamu terima Rp50.000 dari ANDI"))
        assertTrue(CaptureFilter.isCandidate("", "Pembelian token listrik PLN Rp 100.000 berhasil"))
    }

    @Test fun keepsPromosForTheWebToFlag() {
        assertTrue(CaptureFilter.isCandidate("Promo", "Cashback hingga Rp50rb! Yuk belanja hari ini"))
    }

    @Test fun dropsNotificationsWithoutAmount() {
        assertFalse(CaptureFilter.isCandidate("Login", "Akun kamu masuk dari perangkat baru"))
    }

    @Test fun neverUploadsSecrets() {
        assertFalse(CaptureFilter.isCandidate("BCA", "Kode OTP 123456 untuk transaksi Rp 500.000. Jangan berikan kode ini ke siapapun"))
        assertFalse(CaptureFilter.isCandidate("DANA", "Kode verifikasi kamu 4821 untuk top up Rp100.000"))
        assertFalse(CaptureFilter.isCandidate("Bank", "Masukkan m-PIN untuk transfer Rp 1.000.000"))
    }

    @Test fun parsesAmountForDisplay() {
        assertEquals(1250000L, CaptureFilter.findAmount("Transfer Rp 1.250.000,00 berhasil"))
        assertEquals(18000L, CaptureFilter.findAmount("Pembayaran GoPay Rp18.000"))
        assertEquals(1250000L, CaptureFilter.findAmount("IDR 1,250,000.00"))
    }

    @Test fun stableIds() {
        val a = CaptureFilter.idFor("com.bca", "k1", "t", "x")
        assertEquals(a, CaptureFilter.idFor("com.bca", "k1", "t", "x"))
        assertNotEquals(a, CaptureFilter.idFor("com.bca", "k1", "t", "y"))
    }
}
