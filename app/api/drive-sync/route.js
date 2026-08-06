import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

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

  const webhookUrl = process.env.N8N_DRIVE_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ ok: false });

  const { proyekId, proyek, items } = await req.json();
  if (!proyekId || !proyek || !Array.isArray(items) || items.length === 0)
    return NextResponse.json({ ok: false }, { status: 400 });

  // Foto/video di bucket 'perbaikan' bersifat privat — generate signed URL
  // (1 jam) di sini (bukan di client) supaya link yang dikirim ke n8n hanya
  // hidup sebentar dan tetap lewat RLS milik user yang sedang login.
  const legacyPaths = items.flatMap((it) => [it.foto_url, it.video_url].filter(Boolean));
  const mediaPaths = items.flatMap((it) => (it.media || []).map((m) => m.path).filter(Boolean));
  const paths = [...new Set([...legacyPaths, ...mediaPaths])];
  const { data: signed } = paths.length
    ? await supabase.storage.from("perbaikan").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries(
    (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
  );

  const tanggal = new Date(items[0].created_at).toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });

  const ext = (path) => (path ? path.split(".").pop().toLowerCase() : null);

  const payload = {
    proyekId,
    proyek,
    tanggal,
    items: items.map((it) => {
      const media = (it.media || []).map((m) => ({
        mediaId: m.mediaId,
        tipe: m.tipe,
        url: urlMap[m.path] || null,
        ext: ext(m.path),
      }));
      // Fallback fotoUrl/videoUrl tunggal (foto+video PERTAMA) -- DIPERTAHANKAN
      // supaya n8n workflow LAMA (belum di-update ke bentuk array `media`,
      // lihat n8n/defect-list-drive-sync.json) masih bisa sync sesuatu
      // selama masa transisi, alih-alih gagal total.
      const firstFoto = it.foto_url
        ? { url: urlMap[it.foto_url] || null, ext: ext(it.foto_url) }
        : media.find((m) => m.tipe === "foto");
      const firstVideo = it.video_url
        ? { url: urlMap[it.video_url] || null, ext: ext(it.video_url) }
        : media.find((m) => m.tipe === "video");
      return {
        id: it.id,
        no: it.no,
        uraian: it.uraian,
        jenis: it.jenis === "bukti" ? "bukti" : "temuan",
        fotoUrl: firstFoto?.url || null,
        fotoExt: firstFoto?.ext || null,
        videoUrl: firstVideo?.url || null,
        videoExt: firstVideo?.ext || null,
        media,
      };
    }),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json({ ok: res.ok });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
