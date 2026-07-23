import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import RiwayatLaporanHarianCard from "@/app/supervisor/laporan-harian/RiwayatLaporanHarianCard";
import StatusHariIniCard from "./StatusHariIniCard";

export const dynamic = "force-dynamic";

const HALAMAN = 60;

// Laporan harian dari SEMUA proyek (semua Supervisor) — Master tidak perlu
// buka satu-satu halaman detail proyek untuk lihat laporan yang masuk.
export default async function LaporanHarianMasterPage() {
  const { supabase } = await getSessionProfile();

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const [{ data: proyekAktif }, { data: rows }] = await Promise.all([
    supabase
      .from("proyek")
      .select("id, nama, supervisor:supervisor_id(name)")
      .eq("is_active", true)
      .order("nama"),
    supabase
      .from("laporan_harian")
      .select("id, tanggal, deskripsi, status, foto_url, created_at, dibaca_master, proyek:proyek_id(nama)")
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(HALAMAN),
  ]);

  // Laporan hari ini per proyek aktif — dipakai buat "Status Hari Ini" di atas.
  const { data: rowsHariIni } = await supabase
    .from("laporan_harian")
    .select("id, proyek_id, deskripsi, status, foto_url, created_at")
    .eq("tanggal", todayStr)
    .in("proyek_id", (proyekAktif || []).map((p) => p.id).length ? (proyekAktif || []).map((p) => p.id) : [""]);

  // Tandai laporan baru sudah dilihat Master supaya badge di dashboard hilang.
  const belumDibaca = (rows || []).filter((r) => !r.dibaca_master).map((r) => r.id);
  if (belumDibaca.length > 0) {
    await supabase.from("laporan_harian").update({ dibaca_master: true }).in("id", belumDibaca);
  }

  const paths = [
    ...(rows || []).filter((r) => r.foto_url).map((r) => r.foto_url),
    ...(rowsHariIni || []).filter((r) => r.foto_url).map((r) => r.foto_url),
  ];
  const { data: signed } = paths.length
    ? await supabase.storage.from("progres").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries(
    (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
  );

  const riwayat = (rows || []).map((r) => ({
    ...r,
    fotoSignedUrl: r.foto_url ? urlMap[r.foto_url] || null : null,
  }));

  const itemsHariIniByProyek = new Map();
  for (const r of rowsHariIni || []) {
    const item = { ...r, fotoSignedUrl: r.foto_url ? urlMap[r.foto_url] || null : null };
    if (!itemsHariIniByProyek.has(r.proyek_id)) itemsHariIniByProyek.set(r.proyek_id, []);
    itemsHariIniByProyek.get(r.proyek_id).push(item);
  }

  const statusHariIni = (proyekAktif || []).map((p) => ({
    id: p.id,
    nama: p.nama,
    supervisorNama: p.supervisor?.name || null,
    items: itemsHariIniByProyek.get(p.id) || [],
  }));

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <h1 className="text-xl font-bold tracking-tight">Laporan Harian</h1>
      <p className="mb-4 text-sm text-gray-500">Laporan harian semua proyek dari Supervisor</p>

      <StatusHariIniCard proyekList={statusHariIni} />

      {riwayat.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400">
          Belum ada laporan harian dari Supervisor manapun.
        </div>
      ) : (
        <RiwayatLaporanHarianCard riwayat={riwayat} />
      )}
    </main>
  );
}
