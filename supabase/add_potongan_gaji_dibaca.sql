-- Jalankan di Supabase Studio > SQL Editor
-- Badge notifikasi: potongan gaji baru (diisi bot Telegram/n8n, bukan lewat
-- app ini) belum dilihat Supervisor di halaman Rekap Gaji.

alter table potongan_gaji
  add column if not exists dibaca_supervisor boolean not null default false;
