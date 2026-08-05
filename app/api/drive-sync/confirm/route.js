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
// foto/video defect item ini berhasil diupload ke Google Drive. Menandai
// baris ini aman dibersihkan dari Supabase Storage oleh
// /api/drive-sync/cleanup setelah masa retensi berlalu.
// body: { id }
export async function POST(req) {
  const secret = req.headers.get("x-n8n-secret");
  if (!secret || secret !== process.env.N8N_CALLBACK_SECRET)
    return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  await supabaseAdmin
    .from("checklist_perbaikan")
    .update({ drive_synced_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
