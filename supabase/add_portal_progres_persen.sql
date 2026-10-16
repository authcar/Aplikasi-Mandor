-- Portal Klien: progres sebagian per tahap.
-- Tahap yang dicentang punya persen pengerjaan 1–100 (mis. Potong baru 10%).
-- Baris lama otomatis 100 (= tahap selesai penuh, sama seperti sebelumnya).
-- Fase berikutnya baru terbuka setelah semua tahap fase sebelumnya 100%.
-- Jalankan sekali di Supabase Studio > SQL Editor. Aman dijalankan ulang.

alter table portal_progres
  add column if not exists persen numeric(5,2) not null default 100;

alter table portal_progres drop constraint if exists portal_progres_persen_check;
alter table portal_progres
  add constraint portal_progres_persen_check check (persen > 0 and persen <= 100);
