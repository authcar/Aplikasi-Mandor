// Defect list dari klien (tabel portal_defect, supabase/add_portal_defect.sql).
// Server-only: foto ada di bucket privat dan ditampilkan lewat signed URL.
import { db, hasil } from "./db";
import { isiDariMandor } from "./mandor";

export const BUCKET_DEFECT = "portal-defect";
export const MAKS_FOTO_DEFECT = 5;
export const MAKS_KETERANGAN_DEFECT = 1000;
// Signed URL foto berlaku 6 jam; halaman klien & staf memuat ulang data jauh
// lebih sering dari itu.
const UMUR_URL = 6 * 3600;

// Semua path foto satu baris defect: laporan klien + tanggapan tim
// (foto_tanggapan, supabase/add_portal_defect_foto_tanggapan.sql).
export const semuaFotoDefect = (r) => [...(r.foto || []), ...(r.foto_tanggapan || [])];

// Defect satu proyek, terbaru dulu, dengan foto & foto_tanggapan berupa { path, url }.
// Tabel belum dibuat (SQL belum dijalankan) -> [] supaya halaman tetap jalan.
export async function ambilDefect(proyekId) {
  let rows;
  try {
    rows = await hasil(
      db().from("portal_defect").select("*, pengubah:diubah_oleh(name)").eq("proyek_id", proyekId).order("created_at", { ascending: false })
    );
  } catch (e) {
    if (/could not find the table|does not exist|schema cache/i.test(e.message)) return [];
    throw e;
  }
  const paths = rows.flatMap(semuaFotoDefect);
  const url = {};
  if (paths.length) {
    const { data } = await db().storage.from(BUCKET_DEFECT).createSignedUrls(paths, UMUR_URL);
    for (const d of data || []) if (d.signedUrl) url[d.path] = d.signedUrl;
  }
  // Baris yang tersambung ke Defect List Mandor (checklist_id): status & foto
  // diambil dari sana (lib/portal/mandor.js).
  return isiDariMandor(
    rows.map(({ pengubah, ...r }) => ({
      ...r,
      diubah_nama: pengubah?.name || null,
      foto: (r.foto || []).map((path) => ({ path, url: url[path] || null })),
      foto_tanggapan: (r.foto_tanggapan || []).map((path) => ({ path, url: url[path] || null })),
    }))
  );
}

// Jumlah defect BARU per proyek: { [proyek_id]: n }. Untuk tanda di daftar proyek.
// Baris yang tersambung ke Defect List Mandor dihitung baru selama itemnya
// masih OPEN (belum dikerjakan). Kolom checklist_id belum ada -> cara lama.
export async function hitungDefectBaru() {
  const jumlah = (rows) => rows.reduce((a, r) => ({ ...a, [r.proyek_id]: (a[r.proyek_id] || 0) + 1 }), {});
  try {
    const rows = await hasil(db().from("portal_defect").select("proyek_id, status, checklist_id, cl:checklist_id(status)"));
    return jumlah(rows.filter((r) => (r.checklist_id ? r.cl?.status === "OPEN" : r.status === "BARU")));
  } catch {
    try {
      return jumlah(await hasil(db().from("portal_defect").select("proyek_id").eq("status", "BARU")));
    } catch {
      return {};
    }
  }
}

// Hapus foto defect satu proyek dari storage (dipanggil sebelum proyek dihapus;
// baris defect-nya ikut terhapus lewat on delete cascade).
export async function hapusFotoDefect(proyekId) {
  try {
    const rows = await hasil(db().from("portal_defect").select("*").eq("proyek_id", proyekId));
    const paths = rows.flatMap(semuaFotoDefect);
    if (paths.length) await db().storage.from(BUCKET_DEFECT).remove(paths);
  } catch {
    // Tabel belum ada / storage gagal: jangan halangi penghapusan proyek.
  }
}
