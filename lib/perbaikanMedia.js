// Gabungkan media LAMA (kolom foto_url/video_url/foto_bukti_url/video_bukti_url
// di checklist_perbaikan, item lama) dengan media BARU (checklist_perbaikan_media,
// bisa banyak per item) jadi 2 array per item: mediaTemuan & mediaBukti.
// Dipakai di 4 halaman: supervisor/mandor/master/finance perbaikan/page.jsx.
//
// Begitu sebuah file sudah ke-sync ke Google Drive (drive_file_id terisi,
// lihat app/api/drive-sync/confirm), file aslinya SUDAH dihapus dari Supabase
// Storage -- jadi entry media-nya diarahkan ke Google Drive, bukan lagi ke
// urlMap (signed URL Supabase). `url` selalu link gambar (thumbnail Drive
// utk foto/video, atau signed URL Supabase selama masih tersimpan di sana)
// supaya tetap bisa dipakai langsung di <img>. `driveUrl` cuma terisi kalau
// file itu ada di Drive -- dipakai UI utk tombol "Buka di Google Drive"
// (lihat components/MediaGallery.jsx & FotoLightbox.jsx), karena video Drive
// tidak bisa di-stream langsung lewat <video src> tanpa OAuth.

const driveThumbUrl = (fileId) => `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
const driveViewUrl = (fileId) => `https://drive.google.com/file/d/${fileId}/view`;

function buatEntryMedia({ driveId, path, tipe, urlMap }) {
  if (driveId) {
    return { url: driveThumbUrl(driveId), driveUrl: driveViewUrl(driveId), tipe };
  }
  return { url: urlMap[path] || null, driveUrl: null, tipe };
}

export function gabungkanMediaPerbaikan(rows, mediaRows, urlMap) {
  const byChecklist = new Map();
  for (const m of mediaRows || []) {
    if (!byChecklist.has(m.checklist_id)) byChecklist.set(m.checklist_id, []);
    byChecklist.get(m.checklist_id).push(m);
  }
  return (rows || []).map((r) => {
    const mediaTemuan = [];
    const mediaBukti = [];
    if (r.foto_url || r.foto_drive_file_id)
      mediaTemuan.push(buatEntryMedia({ driveId: r.foto_drive_file_id, path: r.foto_url, tipe: "foto", urlMap }));
    if (r.video_url || r.video_drive_file_id)
      mediaTemuan.push(buatEntryMedia({ driveId: r.video_drive_file_id, path: r.video_url, tipe: "video", urlMap }));
    if (r.foto_bukti_url || r.foto_bukti_drive_file_id)
      mediaBukti.push(buatEntryMedia({ driveId: r.foto_bukti_drive_file_id, path: r.foto_bukti_url, tipe: "foto", urlMap }));
    if (r.video_bukti_url || r.video_bukti_drive_file_id)
      mediaBukti.push(buatEntryMedia({ driveId: r.video_bukti_drive_file_id, path: r.video_bukti_url, tipe: "video", urlMap }));
    for (const m of (byChecklist.get(r.id) || []).sort((a, b) => a.urutan - b.urutan)) {
      const entry = {
        id: m.id,
        path: m.path,
        ...buatEntryMedia({ driveId: m.drive_file_id, path: m.path, tipe: m.tipe, urlMap }),
      };
      (m.jenis === "bukti" ? mediaBukti : mediaTemuan).push(entry);
    }
    return {
      mediaTemuan: mediaTemuan.filter((m) => m.url),
      mediaBukti: mediaBukti.filter((m) => m.url),
    };
  });
}
