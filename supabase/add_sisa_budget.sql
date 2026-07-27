-- Jalankan di Supabase Studio > SQL Editor.
--
-- Kolom baru "Sisa Budget" per proyek — diinput manual oleh Master (lewat
-- app/api/proyek/route.js, halaman /master/proyek/[id]), lalu ditampilkan
-- read-only ke Mandor di dashboard (app/mandor/page.jsx), sama persis
-- polanya dengan nilai_proyek (Nilai Jasa Tukang).
--
-- Tidak perlu policy RLS baru: proyek_write (add_master_rls_fix.sql) sudah
-- mengizinkan MASTER mengubah kolom apa pun di tabel proyek, dan proyek_read
-- sudah mengizinkan Mandor membaca baris proyeknya sendiri.

alter table proyek add column if not exists sisa_budget numeric(14,0);
