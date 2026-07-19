import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import RiwayatLaporanHarianCard from "@/app/supervisor/laporan-harian/RiwayatLaporanHarianCard";

export const dynamic = "force-dynamic";

const HALAMAN = 60;

// Laporan harian dari SEMUA proyek (semua Supervisor) — Master tidak perlu
// buka satu-satu halaman detail proyek untuk lihat laporan yang masuk.
export default async function LaporanHarianMasterPage() {
  const { supabase } = await getSessionProfile();

  const { data: rows } = await supabase
    .from("laporan_harian")
    .select("id, tanggal, deskripsi, status, foto_url, created_at, proyek:proyek_id(nama)")
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(HALAMAN);

  const paths = (rows || []).filter((r) => r.foto_url).map((r) => r.foto_url);
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

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <h1 className="text-xl font-bold tracking-tight">Laporan Harian</h1>
      <p className="mb-4 text-sm text-gray-500">Laporan harian semua proyek dari Supervisor</p>

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
