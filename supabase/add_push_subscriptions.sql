-- Jalankan di Supabase Studio > SQL Editor
-- Tabel penyimpanan Web Push subscription (PWA) per akun. Satu akun bisa
-- punya lebih dari satu subscription (login di beberapa device/browser).

create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);
create index if not exists idx_push_subscriptions_profile on push_subscriptions(profile_id);

alter table push_subscriptions enable row level security;

-- Tiap akun hanya boleh baca/tulis/hapus subscription miliknya sendiri.
drop policy if exists push_subscriptions_own_rw on push_subscriptions;
create policy push_subscriptions_own_rw on push_subscriptions for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
