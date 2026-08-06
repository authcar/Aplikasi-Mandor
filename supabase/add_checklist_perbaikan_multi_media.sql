-- Jalankan di Supabase Studio > SQL Editor.
--
-- Checklist Perbaikan sebelumnya cuma bisa 1 foto ATAU 1 video per item
-- (lihat foto_url/video_url/foto_bukti_url/video_bukti_url di
-- checklist_perbaikan) -- baik utk temuan awal Supervisor maupun bukti
-- pengerjaan Mandor. Sekarang bisa lebih dari 1 file (maks 5/item),
-- disimpan di tabel terpisah supaya jumlahnya fleksibel.
--
-- Kolom lama (foto_url, video_url, foto_bukti_url, video_bukti_url) TETAP
-- ADA dan TIDAK di-migrasi -- data lama tetap dibaca dari sana (read-only
-- utk item existing), sementara semua upload BARU (temuan maupun bukti)
-- mulai sekarang ditulis ke checklist_perbaikan_media. Halaman yang
-- menampilkan (page.jsx di supervisor/mandor/master/finance) digabung jadi
-- satu array media per item (lib/perbaikanMedia.js) supaya item lama & baru
-- tampil konsisten.

create table checklist_perbaikan_media (
  id             uuid primary key default gen_random_uuid(),
  checklist_id   uuid not null references checklist_perbaikan(id) on delete cascade,
  jenis          text not null check (jenis in ('temuan','bukti')),
  tipe           text not null check (tipe in ('foto','video')),
  path           text not null,                 -- path di bucket storage 'perbaikan', sama konvensi dgn kolom lama
  urutan         int not null default 0,         -- urutan tampil (index saat diupload), bukan diambil dari created_at
                                                  -- supaya urutannya stabil walau di-insert dalam 1 statement (timestamp sama persis)
  drive_synced_at timestamptz,                    -- pengganti drive_synced_at/bukti_synced_at level-baris, tapi PER FILE
  created_at     timestamptz default now()
);
create index idx_checklist_perbaikan_media_checklist on checklist_perbaikan_media(checklist_id);

comment on column checklist_perbaikan_media.drive_synced_at is
  'Waktu file ini terkonfirmasi sudah ke-backup ke Google Drive (diisi n8n lewat /api/drive-sync/confirm, bentuk baru { mediaId }). NULL = belum/gagal sync -- TIDAK PERNAH dihapus otomatis oleh cleanup job sampai ini terisi. Sejalan dgn checklist_perbaikan.drive_synced_at/bukti_synced_at yang tetap dipakai utk item LAMA.';

alter table checklist_perbaikan_media enable row level security;

-- Akses ikut PERSIS aturan checklist_perbaikan itu sendiri (checklist_rw,
-- lihat add_checklist_assigned_mandor.sql) -- SENGAJA subquery ke tabel itu
-- (bukan menuliskan ulang "proyek_id in (select my_proyek_ids())" di sini)
-- supaya kalau aturan akses checklist_perbaikan berubah lagi nanti (mis.
-- ada jenis assignment baru), policy media ini otomatis ikut tanpa perlu
-- diubah terpisah. Ini aman dari rekursi karena checklist_rw sendiri hanya
-- bergantung ke my_proyek_ids() (security definer, bypass RLS proyek).
create policy checklist_perbaikan_media_rw on checklist_perbaikan_media for all
  using (checklist_id in (select id from checklist_perbaikan))
  with check (checklist_id in (select id from checklist_perbaikan));

-- Tidak perlu policy storage baru -- bucket 'perbaikan' sudah mengizinkan
-- read/write dengan path '<proyek_id>/<file>' utk siapa saja yang berhak
-- di proyek itu (termasuk mandor assigned manual, lihat
-- add_checklist_assigned_mandor.sql), lepas dari nama filenya.

-- Hardening: batasi maksimal 5 file per (checklist_id, jenis) di level DB,
-- bukan cuma di UI, supaya cap 5 tidak bisa dilewati kalau ada bug di client.
create or replace function checklist_perbaikan_media_cap_check()
returns trigger language plpgsql as $$
begin
  if (select count(*) from checklist_perbaikan_media
      where checklist_id = new.checklist_id and jenis = new.jenis) >= 5 then
    raise exception 'Maksimal 5 media per item (jenis=%)', new.jenis;
  end if;
  return new;
end;
$$;

create trigger trg_checklist_perbaikan_media_cap
before insert on checklist_perbaikan_media
for each row execute function checklist_perbaikan_media_cap_check();
