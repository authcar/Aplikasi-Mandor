import { createClient as createAdminClient } from "@supabase/supabase-js";

// Siapa yang boleh MEMBUAT laporan harian, dan client apa yang dipakai.
//
// RLS laporan_harian / laporan_manpower / bucket "progres" hanya mengenal
// SUPERVISOR (proyek miliknya) dan MASTER. HEAD_OF_PRODUCTION memegang semua
// proyek, jadi ia memakai client service role — ITU MELEWATI RLS, jadi setiap
// route yang memakainya wajib sudah memeriksa role (lewat ROLE_LAPOR) dan
// mengikat created_by ke dirinya sendiri.
export const ROLE_LAPOR = ["SUPERVISOR", "HEAD_OF_PRODUCTION"];

export const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const klienLaporan = (profile, supabaseUser) =>
  profile.role === "HEAD_OF_PRODUCTION" ? supabaseAdmin : supabaseUser;
