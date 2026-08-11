-- Jalankan di Supabase Studio > SQL Editor.
--
-- Naikkan cap checklist_perbaikan_media dari 5 jadi 10 file per
-- (checklist_id, jenis) -- lihat add_checklist_perbaikan_multi_media.sql
-- utk trigger aslinya. MAX_MEDIA di sisi UI (PerbaikanForm.jsx,
-- PerbaikanMandorList.jsx) sudah dinaikkan jadi 10 juga, jadi trigger DB
-- ini perlu disamakan supaya tidak menolak upload ke-6..10.

create or replace function checklist_perbaikan_media_cap_check()
returns trigger language plpgsql as $$
begin
  if (select count(*) from checklist_perbaikan_media
      where checklist_id = new.checklist_id and jenis = new.jenis) >= 10 then
    raise exception 'Maksimal 10 media per item (jenis=%)', new.jenis;
  end if;
  return new;
end;
$$;
