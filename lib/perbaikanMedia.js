// Gabungkan media LAMA (kolom foto_url/video_url/foto_bukti_url/video_bukti_url
// di checklist_perbaikan, item lama) dengan media BARU (checklist_perbaikan_media,
// bisa banyak per item) jadi 2 array per item: mediaTemuan & mediaBukti.
// Dipakai di 4 halaman: supervisor/mandor/master/finance perbaikan/page.jsx.
export function gabungkanMediaPerbaikan(rows, mediaRows, urlMap) {
  const byChecklist = new Map();
  for (const m of mediaRows || []) {
    if (!byChecklist.has(m.checklist_id)) byChecklist.set(m.checklist_id, []);
    byChecklist.get(m.checklist_id).push(m);
  }
  return (rows || []).map((r) => {
    const mediaTemuan = [];
    const mediaBukti = [];
    if (r.foto_url) mediaTemuan.push({ url: urlMap[r.foto_url] || null, tipe: "foto" });
    if (r.video_url) mediaTemuan.push({ url: urlMap[r.video_url] || null, tipe: "video" });
    if (r.foto_bukti_url) mediaBukti.push({ url: urlMap[r.foto_bukti_url] || null, tipe: "foto" });
    if (r.video_bukti_url) mediaBukti.push({ url: urlMap[r.video_bukti_url] || null, tipe: "video" });
    for (const m of (byChecklist.get(r.id) || []).sort((a, b) => a.urutan - b.urutan)) {
      const entry = { id: m.id, url: urlMap[m.path] || null, tipe: m.tipe, path: m.path };
      (m.jenis === "bukti" ? mediaBukti : mediaTemuan).push(entry);
    }
    return {
      mediaTemuan: mediaTemuan.filter((m) => m.url),
      mediaBukti: mediaBukti.filter((m) => m.url),
    };
  });
}
