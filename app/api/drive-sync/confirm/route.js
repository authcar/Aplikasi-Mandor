import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Admin client lokal (service role, bypass RLS) — sama pola dengan lib/notify.js.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Kolom path & drive_file_id di checklist_perbaikan per kombinasi jenis+tipe
// (item LAMA pra-migrasi multi-media, lihat supabase/add_checklist_perbaikan_multi_media.sql).
function kolomLegacy(jenis, tipe) {
  const suffix = jenis === "bukti" ? "_bukti" : "";
  const prefix = tipe === "video" ? "video" : "foto";
  return { kolomPath: `${prefix}${suffix}_url`, kolomDrive: `${prefix}${suffix}_drive_file_id` };
}

// POST /api/drive-sync/confirm — dipanggil n8n (server-to-server, bukan
// browser, makanya auth pakai shared secret bukan session) setelah
// foto/video berhasil diupload ke Google Drive. Begitu dikonfirmasi, file
// ASLI di Supabase Storage langsung dihapus (bukan ditunda retensi lagi) —
// drive_file_id yang tersimpan dipakai app buat menampilkan foto/video dari
// Google Drive (lihat lib/perbaikanMedia.js). Kalau hapus dari Storage
// gagal, path SENGAJA tidak dikosongkan supaya /api/drive-sync/cleanup masih
// bisa membereskannya belakangan sebagai jaring pengaman.
// body BARU (per file, item pasca multi-media): { mediaId, driveFileId }
// body LAMA (per baris checklist, item pra-migrasi): { id, jenis?: 'temuan'|'bukti', tipe?: 'foto'|'video', driveFileId }
// Dua bentuk didukung sekaligus selama masa transisi n8n workflow lama/baru
// (lihat n8n/defect-list-drive-sync.json).
export async function POST(req) {
  const secret = req.headers.get("x-n8n-secret");
  if (!secret || secret !== process.env.N8N_CALLBACK_SECRET)
    return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json();
  if (!body.driveFileId) return NextResponse.json({ ok: false }, { status: 400 });

  if (body.mediaId) {
    const { data: media } = await supabaseAdmin
      .from("checklist_perbaikan_media")
      .select("path")
      .eq("id", body.mediaId)
      .maybeSingle();

    let pathDihapus = true;
    if (media?.path) {
      const { error: removeError } = await supabaseAdmin.storage.from("perbaikan").remove([media.path]);
      pathDihapus = !removeError;
    }

    await supabaseAdmin
      .from("checklist_perbaikan_media")
      .update({
        drive_file_id: body.driveFileId,
        drive_synced_at: new Date().toISOString(),
        ...(pathDihapus ? { path: null } : {}),
      })
      .eq("id", body.mediaId);

    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const jenis = body.jenis === "bukti" ? "bukti" : "temuan";
    const tipe = body.tipe === "video" ? "video" : "foto";
    const { kolomPath, kolomDrive } = kolomLegacy(jenis, tipe);
    const kolomSync = jenis === "bukti" ? "bukti_synced_at" : "drive_synced_at";

    const { data: row } = await supabaseAdmin
      .from("checklist_perbaikan")
      .select(kolomPath)
      .eq("id", body.id)
      .maybeSingle();
    const path = row?.[kolomPath];

    let pathDihapus = true;
    if (path) {
      const { error: removeError } = await supabaseAdmin.storage.from("perbaikan").remove([path]);
      pathDihapus = !removeError;
    }

    await supabaseAdmin
      .from("checklist_perbaikan")
      .update({
        [kolomDrive]: body.driveFileId,
        [kolomSync]: new Date().toISOString(),
        ...(pathDihapus ? { [kolomPath]: null } : {}),
      })
      .eq("id", body.id);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
