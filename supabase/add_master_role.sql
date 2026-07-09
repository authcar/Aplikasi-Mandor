-- Jalankan di Supabase Studio > SQL Editor — JALANKAN FILE INI SENDIRIAN DULU,
-- baru jalankan add_master_rls_fix.sql setelah ini selesai (bukan digabung
-- jadi satu query sekaligus). Postgres tidak mengizinkan ADD VALUE pada enum
-- dipakai di policy pada transaksi yang sama.
--
-- Jika role 'MASTER' sudah ada di enum user_role (mis. ditambahkan manual
-- sebelumnya lewat Studio), perintah ini aman dijalankan ulang (no-op).

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MASTER';
