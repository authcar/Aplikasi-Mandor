-- Jalankan di Supabase Studio > SQL Editor — JALANKAN FILE INI SENDIRIAN
-- DULU, baru jalankan add_finance_rls.sql setelah ini selesai (bukan
-- digabung jadi satu query sekaligus). Postgres tidak mengizinkan ADD VALUE
-- pada enum dipakai di policy pada transaksi yang sama (sama seperti
-- add_master_role.sql dulu).
--
-- Role baru FINANCE: wewenangnya SAMA seperti MASTER di semua fitur
-- (persetujuan kasbon/reimburse/lembur, kelola akun, lihat semua proyek,
-- dll — lihat add_finance_rls.sql), KECUALI: input Nilai Jasa Tukang &
-- Sisa Budget per proyek (app/api/proyek/route.js) sekarang JADI TUGAS
-- FINANCE — Master tidak bisa lagi mengubah dua field itu.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'FINANCE';
