import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

// POST /api/drive-sync — dipanggil dari PerbaikanForm setelah defect baru
// berhasil disimpan, buat trigger workflow n8n yang upload foto/video ke
// Google Drive. n8n sendiri yang cari folder tujuan lewat nama proyek
// (proyek.nama di app ini match persis dengan nama folder proyek di Drive)
// -> "4. Dokumentasi" -> "1. Defect List" -> subfolder per tanggal. Sama
// seperti /api/notify: gagal di sini tidak menandakan data gagal tersimpan
// — data checklist sudah tersimpan sebelum ini dipanggil, endpoint ini
// cuma pelengkap.
// body: { proyekId, proyek, items: [{ id, no, uraian, foto_url, video_url, created_at }] }
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
  const paths = items.flatMap((it) => [it.foto_url, it.video_url].filter(Boolean));
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
    items: items.map((it) => ({
      id: it.id,
      no: it.no,
      uraian: it.uraian,
      fotoUrl: it.foto_url ? urlMap[it.foto_url] || null : null,
      fotoExt: ext(it.foto_url),
      videoUrl: it.video_url ? urlMap[it.video_url] || null : null,
      videoExt: ext(it.video_url),
    })),
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
