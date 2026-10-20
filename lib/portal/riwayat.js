// Riwayat perubahan progres tahap (tabel portal_progres_riwayat,
// supabase/add_portal_progres_riwayat.sql). Server-only. Dasar laporan mingguan
// (lib/portal/mingguan.js).
import { db, hasil } from "./db";

const tabelBelumAda = (e) => /could not find the table|does not exist|schema cache/i.test(e?.message || "");
const HALAMAN = 1000; // batas baris per permintaan PostgREST

// Semua riwayat satu proyek: [{ item_id, tahap, persen, tgl, at }]. Tabel belum
// ada -> [] (laporan memakai keadaan terakhir saja).
export async function ambilRiwayat(proyekId) {
  const out = [];
  try {
    for (let dari = 0; ; dari += HALAMAN) {
      const rows = await hasil(
        db().from("portal_progres_riwayat")
          .select("item_id, tahap, persen, tgl, at")
          .eq("proyek_id", proyekId)
          .order("id")
          .range(dari, dari + HALAMAN - 1)
      );
      out.push(...rows.map((r) => ({ ...r, persen: Number(r.persen) })));
      if (rows.length < HALAMAN) break;
    }
  } catch (e) {
    if (tabelBelumAda(e)) return [];
    throw e;
  }
  return out;
}

// Catat satu perubahan (persen 0 = dibatalkan). Gagal (mis. tabel belum ada)
// tidak boleh menggagalkan pencatatan progres itu sendiri.
export async function catatRiwayat({ proyekId, itemId, tahap, persen, tgl, oleh }) {
  try {
    await hasil(db().from("portal_progres_riwayat").insert({ proyek_id: proyekId, item_id: itemId, tahap, persen, tgl, oleh }));
  } catch {}
}
