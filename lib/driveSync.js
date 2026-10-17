// Kirim item Defect List (checklist_perbaikan) ke workflow n8n yang
// mengunggah foto/video ke Google Drive. Dipakai /api/drive-sync (dari
// PerbaikanForm & PerbaikanMandorList, client yang login) dan dari server
// portal (defect dari klien lewat /api/portal/defect, client service role).
// `supabase` = client yang dipakai membuat signed URL bucket 'perbaikan'.
// Tidak pernah melempar error: data checklist sudah tersimpan sebelum ini
// dipanggil, sync ke Drive cuma pelengkap. Return true kalau webhook menerima.
// body: { proyekId, proyek, items: [{ id, no, uraian, created_at, jenis?,
//   foto_url?, video_url?,            // legacy path (item LAMA saja)
//   media?: [{ mediaId, tipe, path }]  // item BARU (checklist_perbaikan_media)
// }] }
export async function kirimDriveSync(supabase, { proyekId, proyek, items }) {
  const webhookUrl = process.env.N8N_DRIVE_WEBHOOK_URL;
  if (!webhookUrl || !proyekId || !proyek || !Array.isArray(items) || !items.length) return false;

  // Foto/video di bucket 'perbaikan' bersifat privat — generate signed URL
  // (1 jam) di sini (bukan di client) supaya link yang dikirim ke n8n hanya
  // hidup sebentar (lewat client `supabase`: RLS user yang login, atau service role dari server portal).
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
    return res.ok;
  } catch {
    return false;
  }
}
