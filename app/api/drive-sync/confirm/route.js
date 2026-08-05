import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Admin client lokal (service role, bypass RLS) — sama pola dengan lib/notify.js.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// POST /api/drive-sync/confirm — dipanggil n8n (server-to-server, bukan
// browser, makanya auth pakai shared secret bukan session) setelah
// foto/video item ini berhasil diupload ke Google Drive. Menandai baris ini
// aman dibersihkan dari Supabase Storage oleh /api/drive-sync/cleanup
// setelah masa retensi berlalu. `jenis` menentukan kolom timestamp mana
// yang di-update — temuan awal & bukti pengerjaan dilacak terpisah karena
// bisa disubmit di waktu yang beda jauh.
// body: { id, jenis?: 'temuan'|'bukti' }
export async function POST(req) {
  const secret = req.headers.get("x-n8n-secret");
  if (!secret || secret !== process.env.N8N_CALLBACK_SECRET)
    return NextResponse.json({ ok: false }, { status: 401 });

  const { id, jenis } = await req.json();
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  const field = jenis === "bukti" ? "bukti_synced_at" : "drive_synced_at";

  await supabaseAdmin
    .from("checklist_perbaikan")
    .update({ [field]: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
