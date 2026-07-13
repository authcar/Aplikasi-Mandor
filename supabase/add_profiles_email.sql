-- Jalankan di SQL Editor project Supabase Aplikasi Mandor.
--
-- Kenapa: email akun (Mandor/Supervisor) cuma tersimpan sesaat di respons
-- POST /api/mandor pas dibuat — tidak pernah ditulis ke tabel `profiles`.
-- Begitu halaman di-reload, email jadi tidak terlihat lagi ("—") padahal
-- ini bukan data rahasia seperti password. Simpan permanen di profiles.

alter table profiles add column if not exists email text;

-- Backfill akun yang sudah ada dari auth.users.
update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Auto-isi untuk akun baru ke depannya.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', new.email),
          coalesce((new.raw_user_meta_data->>'role')::user_role, 'MANDOR'),
          new.email);
  return new;
end; $$;
