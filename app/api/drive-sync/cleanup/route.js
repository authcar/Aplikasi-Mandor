import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Admin client lokal (service role, bypass RLS) — sama pola dengan lib/notify.js.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const RETENSI_HARI = 5;

// POST /api/drive-sync/cleanup — dipanggil terjadwal (n8n Schedule Trigger,
// lihat n8n/defect-list-cleanup-schedule.json) buat hapus foto/video defect
// dari Supabase Storage yang sudah lewat RETENSI_HARI sejak dikonfirmasi
// ke-backup ke Google Drive (drive_synced_at, diisi oleh /api/drive-sync/confirm).
// Item yang gagal sync (drive_synced_at masih kosong) SENGAJA tidak pernah
// dihapus di sini — tetap aman sampai ada yang cek manual kenapa gagal.
export async function POST(req) {
  const secret = req.headers.get("x-n8n-secret");
  if (!secret || secret !== process.env.N8N_CALLBACK_SECRET)
    return NextResponse.json({ ok: false }, { status: 401 });

  const batas = new Date(Date.now() - RETENSI_HARI * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("checklist_perbaikan")
    .select("id, foto_url, video_url")
    .not("drive_synced_at", "is", null)
    .lte("drive_synced_at", batas)
    .or("foto_url.not.is.null,video_url.not.is.null");

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ ok: true, dihapus: 0 });

  const paths = rows.flatMap((r) => [r.foto_url, r.video_url].filter(Boolean));
  const { error: removeError } = await supabaseAdmin.storage.from("perbaikan").remove(paths);
  if (removeError) return NextResponse.json({ ok: false, error: removeError.message }, { status: 500 });

  await supabaseAdmin
    .from("checklist_perbaikan")
    .update({ foto_url: null, video_url: null })
    .in(
      "id",
      rows.map((r) => r.id)
    );

  return NextResponse.json({ ok: true, dihapus: rows.length });
}
