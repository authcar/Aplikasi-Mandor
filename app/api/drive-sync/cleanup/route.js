import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Admin client lokal (service role, bypass RLS) — sama pola dengan lib/notify.js.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const RETENSI_HARI = 5;

// Satu "jalur" retensi: cari baris yang <kolomSync>-nya sudah lewat
// RETENSI_HARI, hapus file-nya dari Storage, lalu null-kan link-nya.
// Dipakai 2x — sekali utk temuan awal, sekali utk bukti pengerjaan —
// karena keduanya dilacak & disubmit terpisah (lihat migrasi SQL terkait).
async function bersihkan({ kolomSync, kolomFoto, kolomVideo }) {
  const batas = new Date(Date.now() - RETENSI_HARI * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("checklist_perbaikan")
    .select(`id, ${kolomFoto}, ${kolomVideo}`)
    .not(kolomSync, "is", null)
    .lte(kolomSync, batas)
    .or(`${kolomFoto}.not.is.null,${kolomVideo}.not.is.null`);

  if (error) throw new Error(error.message);
  if (!rows?.length) return 0;

  const paths = rows.flatMap((r) => [r[kolomFoto], r[kolomVideo]].filter(Boolean));
  const { error: removeError } = await supabaseAdmin.storage.from("perbaikan").remove(paths);
  if (removeError) throw new Error(removeError.message);

  await supabaseAdmin
    .from("checklist_perbaikan")
    .update({ [kolomFoto]: null, [kolomVideo]: null })
    .in(
      "id",
      rows.map((r) => r.id)
    );

  return rows.length;
}

// POST /api/drive-sync/cleanup — dipanggil terjadwal (n8n Schedule Trigger,
// lihat n8n/defect-list-cleanup-schedule.json) buat hapus foto/video defect
// (temuan awal & bukti pengerjaan) dari Supabase Storage yang sudah lewat
// RETENSI_HARI sejak dikonfirmasi ke-backup ke Google Drive (diisi oleh
// /api/drive-sync/confirm). Item yang gagal sync (kolom sync-nya masih
// kosong) SENGAJA tidak pernah dihapus di sini — tetap aman sampai ada yang
// cek manual kenapa gagal.
export async function POST(req) {
  const secret = req.headers.get("x-n8n-secret");
  if (!secret || secret !== process.env.N8N_CALLBACK_SECRET)
    return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const [temuan, bukti] = await Promise.all([
      bersihkan({ kolomSync: "drive_synced_at", kolomFoto: "foto_url", kolomVideo: "video_url" }),
      bersihkan({ kolomSync: "bukti_synced_at", kolomFoto: "foto_bukti_url", kolomVideo: "video_bukti_url" }),
    ]);
    return NextResponse.json({ ok: true, dihapus: { temuan, bukti } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
