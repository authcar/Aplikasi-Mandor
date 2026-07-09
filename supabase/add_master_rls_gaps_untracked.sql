-- Jalankan di Supabase Studio > SQL Editor, SETELAH add_master_rls_fix.sql.
--
-- Tabel di bawah ini (absensi_ringkas, absensi_tim, checkin_harian) TIDAK ada
-- di schema.sql atau migrasi manapun — dibuat langsung di Studio. Kolomnya di
-- sini diambil dari cara kode aplikasi memakainya (app/api/absensi/route.js,
-- app/supervisor/absensi/AbsensiTimForm.jsx, components/AbsensiSayaCard.jsx).
-- Semua kebijakan di bawah ADDITIVE (nama baru) — tidak menghapus kebijakan
-- yang mungkin sudah ada di ketiga tabel ini, jadi aman dijalankan tanpa
-- risiko menutup akses yang sudah berfungsi untuk peran lain.
--
-- Jika salah satu ALTER/CREATE di bawah gagal karena tabel/kolom tidak persis
-- sama, jalankan bagian lain satu per satu — tiap blok independen.

-- 1) absensi_ringkas: MASTER & peran proyek lain boleh baca (dipakai di
--    dashboard Master/Supervisor untuk "Hadir hari ini").
alter table absensi_ringkas enable row level security;

drop policy if exists absensi_ringkas_rw on absensi_ringkas;
create policy absensi_ringkas_rw on absensi_ringkas for all
  using (proyek_id in (select my_proyek_ids()))
  with check (proyek_id in (select my_proyek_ids()) and created_by = auth.uid());

-- 2) absensi_tim: MASTER & Supervisor proyek terkait boleh baca/tulis
--    (dipakai oleh laporan "Absensi Harian Tukang" + Riwayat Laporan).
alter table absensi_tim enable row level security;

drop policy if exists absensi_tim_rw on absensi_tim;
create policy absensi_tim_rw on absensi_tim for all
  using (
    exists (
      select 1 from proyek p
      where p.id in (select my_proyek_ids())
    )
    or my_role() = 'MASTER'
  )
  with check (created_by = auth.uid() or my_role() = 'MASTER');

-- 3) checkin_harian: setiap akun (peran apa pun) boleh baca/tulis BARIS
--    MILIKNYA SENDIRI, dicocokkan lewat chat_id (fallback ke profile.id
--    persis seperti logika di halaman Tukang Harian/Supervisor/Mandor).
--    Ini kebijakan tambahan (additive) — dibuat khusus utk menutup celah yang
--    dicurigai memblokir TUKANG_HARIAN; tidak menyentuh kebijakan lain yang
--    mungkin sudah ada untuk MANDOR/SUPERVISOR di tabel ini.
alter table checkin_harian enable row level security;

drop policy if exists checkin_harian_own_rw on checkin_harian;
create policy checkin_harian_own_rw on checkin_harian for all
  using (
    chat_id = coalesce(
      (select telegram_chat_id::text from profiles where id = auth.uid()),
      auth.uid()::text
    )
  )
  with check (
    chat_id = coalesce(
      (select telegram_chat_id::text from profiles where id = auth.uid()),
      auth.uid()::text
    )
  );

-- =====================================================================
-- lembur.tukang_id — schema.sql mendefinisikannya NOT NULL, tapi form
-- pengajuan lembur (Mandor & Tukang Harian) hanya mencatat jumlah orang,
-- bukan tukang tertentu, dan TIDAK PERNAH mengisi kolom ini. Jadikan
-- nullable supaya cocok dengan cara fitur ini sebenarnya dipakai.
-- =====================================================================
alter table lembur alter column tukang_id drop not null;
