import { getSessionProfile } from "@/lib/supabase/server";
import ProyekDetail from "./ProyekDetail";

export const dynamic = "force-dynamic";

const HALAMAN = 30;

export default async function ProyekDetailMasterPage({ params }) {
  const { supabase } = await getSessionProfile();
  const { id } = params;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const [{ data: proyek }, { data: absensiTim }, { data: riwayatRows }] = await Promise.all([
    supabase
      .from("proyek")
      .select("id, nama, lokasi, icon, nilai_proyek, mandor:mandor_id(name), supervisor:supervisor_id(name)")
      .eq("id", id)
      .single(),
    // Absensi tukang harian yang diisi Supervisor (lihat app/supervisor/absensi),
    // disaring ke proyek ini saja — menggantikan absensi_ringkas yang tidak
    // pernah terisi lagi sejak alur absensi_tim dipakai.
    supabase.from("absensi_tim").select("tim, jumlah").eq("proyek_id", id).eq("tanggal", today),
    supabase
      .from("laporan_harian")
      .select("id, tanggal, deskripsi, status, foto_url, created_at")
      .eq("proyek_id", id)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(HALAMAN),
  ]);

  if (!proyek) return <p className="p-6">Proyek tidak ditemukan.</p>;

  // Baris bernama (jumlah null) dihitung 1 orang — sama seperti master/absensi.
  const jumlahHadir = (absensiTim || []).reduce(
    (s, r) => s + (Number(r.jumlah) > 0 ? Number(r.jumlah) : 1),
    0
  );
  const jumlahTim = new Set((absensiTim || []).map((r) => r.tim)).size;

  const paths = (riwayatRows || []).filter((r) => r.foto_url).map((r) => r.foto_url);
  const { data: signed } = paths.length
    ? await supabase.storage.from("progres").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries(
    (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
  );

  const riwayat = (riwayatRows || []).map((r) => ({
    ...r,
    proyek: { nama: proyek.nama },
    fotoSignedUrl: r.foto_url ? urlMap[r.foto_url] || null : null,
  }));

  return (
    <ProyekDetail
      proyek={proyek}
      jumlahHadir={jumlahTim > 0 ? jumlahHadir : null}
      jumlahTim={jumlahTim}
      riwayat={riwayat}
    />
  );
}
