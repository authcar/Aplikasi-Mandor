import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { kirimDriveSync } from "@/lib/driveSync";

// POST /api/drive-sync — dipanggil dari PerbaikanForm (temuan baru) maupun
// PerbaikanMandorList (bukti pengerjaan) setelah foto/video berhasil
// disimpan, buat trigger workflow n8n yang upload ke Google Drive. n8n
// sendiri yang cari folder tujuan lewat nama proyek -> subfolder per
// tanggal. `jenis` per item ('temuan' default, atau 'bukti') menentukan
// penamaan file & kolom mana yang di-update lewat /api/drive-sync/confirm.
// Sama seperti /api/notify: gagal di sini tidak menandakan data gagal
// tersimpan — data checklist sudah tersimpan sebelum ini dipanggil,
// endpoint ini cuma pelengkap.
// body: { proyekId, proyek, items: [{ id, no, uraian, created_at, jenis?,
//   foto_url?, video_url?,            // legacy path (item LAMA saja)
//   media?: [{ mediaId, tipe, path }]  // item BARU (checklist_perbaikan_media)
// }] }
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });

  const { proyekId, proyek, items } = await req.json();
  if (!proyekId || !proyek || !Array.isArray(items) || items.length === 0)
    return NextResponse.json({ ok: false }, { status: 400 });

  // Signed URL dibuat dengan client user yang login (lewat RLS-nya); isi
  // payload & pengiriman ke n8n ada di lib/driveSync.js.
  return NextResponse.json({ ok: await kirimDriveSync(supabase, { proyekId, proyek, items }) });
}
