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
// foto/video berhasil diupload ke Google Drive. Menandai file ini aman
// dibersihkan dari Supabase Storage oleh /api/drive-sync/cleanup setelah
// masa retensi berlalu.
// body BARU (per file, item pasca multi-media): { mediaId }
// body LAMA (per baris checklist, item pra-migrasi): { id, jenis?: 'temuan'|'bukti' }
// Dua bentuk didukung sekaligus selama masa transisi n8n workflow lama/baru
// (lihat n8n/defect-list-drive-sync.json).
export async function POST(req) {
  const secret = req.headers.get("x-n8n-secret");
  if (!secret || secret !== process.env.N8N_CALLBACK_SECRET)
    return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json();

  if (body.mediaId) {
    await supabaseAdmin
      .from("checklist_perbaikan_media")
      .update({ drive_synced_at: new Date().toISOString() })
      .eq("id", body.mediaId);
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const field = body.jenis === "bukti" ? "bukti_synced_at" : "drive_synced_at";
    await supabaseAdmin
      .from("checklist_perbaikan")
      .update({ [field]: new Date().toISOString() })
      .eq("id", body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
