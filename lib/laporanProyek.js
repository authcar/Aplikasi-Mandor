import { db } from "@/lib/portal/db";

// Sumber daftar proyek di Laporan Harian Supervisor:
//   "tracker" (default, sementara) -> portal_proyek (Portal Klien), supervisor = portal_proyek.supervisor_id
//   "taraco"                       -> tabel proyek hasil sinkron Taraco (production ongoing)
// Kembali ke alur Taraco: set env LAPORAN_HARIAN_SUMBER=taraco di Vercel lalu redeploy.
export const SUMBER_LAPORAN = process.env.LAPORAN_HARIAN_SUMBER === "taraco" ? "taraco" : "tracker";

const dariTaraco = async (supabase, supervisorId) =>
  (await supabase.from("proyek").select("id, nama").eq("supervisor_id", supervisorId).eq("is_active", true).order("nama")).data || [];

// Laporan, foto, Man Power, dan PDF terikat ke tabel `proyek`, jadi proyek
// tracker disalin ke sana (kunci: proyek.portal_id, lihat
// supabase/add_proyek_sumber_tracker.sql). Salinan is_active = false: tidak
// muncul di halaman lain dan tidak disentuh sinkron Taraco. Semua proyek
// tracker disalin (bukan hanya milik supervisor ini) supaya supervisor_id di
// salinan selalu ikut penugasan terbaru di tracker.
async function dariTracker(supervisorId) {
  const { data: asal, error } = await db()
    .from("portal_proyek")
    .select("id, nama, lokasi, deadline, supervisor_id, aktif");
  if (error) throw new Error(error.message);
  if (!asal?.length) return [];

  const { data: salinan, error: errSalin } = await db()
    .from("proyek")
    .upsert(
      asal.map((p) => ({
        portal_id: p.id,
        nama: p.nama,
        lokasi: p.lokasi || null,
        deadline: p.deadline || null,
        supervisor_id: p.supervisor_id || null,
        is_active: false,
      })),
      { onConflict: "portal_id" }
    )
    .select("id, nama, portal_id");
  if (errSalin) throw new Error(errSalin.message);

  const milikSaya = new Set(asal.filter((p) => p.aktif && p.supervisor_id === supervisorId).map((p) => p.id));
  return (salinan || [])
    .filter((r) => milikSaya.has(r.portal_id))
    .map(({ id, nama }) => ({ id, nama }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

// Daftar proyek untuk dropdown Laporan Harian Supervisor: [{ id, nama }].
// Gagal membaca tracker (mis. SQL di atas belum dijalankan) -> jatuh ke
// daftar Taraco supaya halaman tetap bisa dipakai.
export async function daftarProyekLaporan(supabase, supervisorId) {
  if (SUMBER_LAPORAN === "taraco") return dariTaraco(supabase, supervisorId);
  try {
    return await dariTracker(supervisorId);
  } catch (e) {
    console.error("daftarProyekLaporan (tracker) gagal, pakai Taraco:", e?.message);
    return dariTaraco(supabase, supervisorId);
  }
}

// SPK (kode) dan Client untuk kop PDF. Proyek tracker -> portal_proyek;
// selainnya -> Taraco, lewat `dariTaracoFn`. Tidak pernah melempar: gagal = null.
export async function identitasProyek(proyek, dariTaracoFn) {
  if (proyek?.portal_id) {
    try {
      const { data } = await db().from("portal_proyek").select("kode, klien_nama").eq("id", proyek.portal_id).maybeSingle();
      return data ? { code: data.kode, client: data.klien_nama } : null;
    } catch {
      return null;
    }
  }
  return dariTaracoFn(proyek?.taraco_id);
}
