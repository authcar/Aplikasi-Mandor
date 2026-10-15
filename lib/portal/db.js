import { createClient } from "@supabase/supabase-js";

// Client server-only (service role, bypass RLS) untuk tabel portal_*.
// Tabel-tabel itu tidak punya policy RLS sama sekali (lihat
// supabase/add_portal_klien.sql), jadi hak akses dicek di lib/portal/server.js
// dan app/(portal)/portal/aksi.js.
// JANGAN pernah import file ini dari komponen client.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    // Next.js menyimpan hasil fetch() di Data Cache (persisten di Vercel), dan
    // `dynamic = "force-dynamic"` saja tidak cukup: halaman klien /k/[token]
    // sempat terus menampilkan progres lama. Data portal harus selalu terbaru.
    global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) },
  }
);

export const db = () => supabaseAdmin;

// Hasil query -> data, atau lempar error supaya tidak diam-diam kosong.
export async function hasil(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
