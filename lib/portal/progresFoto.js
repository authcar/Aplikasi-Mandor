// Foto progres item BOQ (tabel portal_progres_foto, bucket privat 'portal-progres';
// supabase/add_portal_progres_foto.sql). Server-only: ditampilkan lewat signed URL.
import { db, hasil } from "./db";

export const BUCKET_PROGRES = "portal-progres";
export const MAKS_FOTO_PROGRES = 50; // per item
const UMUR_URL = 6 * 3600;

const tabelBelumAda = (e) => /could not find the table|does not exist|schema cache/i.test(e?.message || "");

// Foto progres satu proyek, lama ke baru: [{ id, item_id, tahap, url, created_at, oleh }].
// Tabel belum dibuat (SQL belum dijalankan) -> [] supaya halaman tetap jalan.
export async function ambilFotoProgres(proyekId) {
  let rows;
  try {
    rows = await hasil(
      db().from("portal_progres_foto").select("*, pencatat:dicatat_oleh(name)").eq("proyek_id", proyekId).order("created_at")
    );
  } catch (e) {
    if (tabelBelumAda(e)) return [];
    throw e;
  }
  const url = {};
  if (rows.length) {
    const { data } = await db().storage.from(BUCKET_PROGRES).createSignedUrls(rows.map((r) => r.path), UMUR_URL);
    for (const d of data || []) if (d.signedUrl) url[d.path] = d.signedUrl;
  }
  return rows
    .filter((r) => url[r.path])
    .map((r) => ({ id: r.id, item_id: r.item_id, url: url[r.path], created_at: r.created_at, tahap: r.tahap || null, oleh: r.pencatat?.name || null }));
}

// Hapus berkas foto progres dari storage untuk satu proyek atau beberapa item
// (baris tabelnya ikut terhapus lewat on delete cascade). Gagal tidak
// menghalangi aksi pemanggil.
export async function hapusFotoProgres({ proyekId, itemIds }) {
  try {
    let q = db().from("portal_progres_foto").select("path");
    q = proyekId ? q.eq("proyek_id", proyekId) : q.in("item_id", itemIds);
    const paths = (await hasil(q)).map((r) => r.path);
    for (let n = 0; n < paths.length; n += 100) await db().storage.from(BUCKET_PROGRES).remove(paths.slice(n, n + 100));
  } catch {}
}
