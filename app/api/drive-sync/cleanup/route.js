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

// Jalur retensi ke-3 utk item BARU (pasca multi-media) — checklist_perbaikan_media
// punya drive_synced_at PER FILE (bukan per baris checklist), jadi dibersihkan
// per row media, bukan lewat bersihkan() di atas yang asumsi 1 foto + 1 video
// dalam kolom tetap.
//
// CATATAN: sejak /api/drive-sync/confirm menghapus file dari Storage LANGSUNG
// begitu sync ke Drive dikonfirmasi (lihat komentar di file itu), `path`
// biasanya sudah NULL duluan sebelum fungsi ini sempat jalan — filter
// `.not("path", "is", null)` di bawah bikin fungsi ini otomatis no-op utk
// kasus itu. Ini sekarang cuma jaring pengaman kalau penghapusan langsung
// tadi sempat gagal (mis. error sementara ke Storage API). Baris media
// (drive_file_id, dst) TIDAK dihapus di sini -- cuma `path`-nya dikosongkan
// -- karena drive_file_id masih dipakai app buat menampilkan foto/video dari
// Google Drive selamanya (lihat lib/perbaikanMedia.js), bukan cuma backup.
async function bersihkanMedia() {
  const batas = new Date(Date.now() - RETENSI_HARI * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("checklist_perbaikan_media")
    .select("id, path")
    .not("drive_synced_at", "is", null)
    .not("path", "is", null)
    .lte("drive_synced_at", batas);

  if (error) throw new Error(error.message);
  if (!rows?.length) return 0;

  const { error: removeError } = await supabaseAdmin.storage.from("perbaikan").remove(rows.map((r) => r.path));
  if (removeError) throw new Error(removeError.message);

  await supabaseAdmin
    .from("checklist_perbaikan_media")
    .update({ path: null })
    .in("id", rows.map((r) => r.id));

  return rows.length;
}

// POST /api/drive-sync/cleanup — dipanggil terjadwal (n8n Schedule Trigger,
// lihat n8n/defect-list-cleanup-schedule.json). Sejak /api/drive-sync/confirm
// menghapus file dari Storage segera setelah sync ke Drive dikonfirmasi,
// endpoint ini SEHARUSNYA jarang menemukan apa pun -- cuma jaring pengaman
// kalau penghapusan langsung tadi gagal, dengan jeda RETENSI_HARI sebelum
// dicoba lagi. Item yang gagal sync (kolom sync-nya masih kosong) SENGAJA
// tidak pernah dihapus di sini — tetap aman sampai ada yang cek manual
// kenapa gagal.
export async function POST(req) {
  const secret = req.headers.get("x-n8n-secret");
  if (!secret || secret !== process.env.N8N_CALLBACK_SECRET)
    return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const [temuan, bukti, mediaBaru] = await Promise.all([
      bersihkan({ kolomSync: "drive_synced_at", kolomFoto: "foto_url", kolomVideo: "video_url" }),
      bersihkan({ kolomSync: "bukti_synced_at", kolomFoto: "foto_bukti_url", kolomVideo: "video_bukti_url" }),
      bersihkanMedia(),
    ]);
    return NextResponse.json({ ok: true, dihapus: { temuan, bukti, mediaBaru } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
