import { getSessionProfile } from "@/lib/supabase/server";
import { daftarProyekLaporan } from "@/lib/laporanProyek";
import { tambahUrlFoto } from "@/lib/laporanFoto";
import LaporanHarianForm from "./LaporanHarianForm";

export const dynamic = "force-dynamic";

const HALAMAN = 30;

export default async function LaporanHarianPage() {
  const { profile, supabase } = await getSessionProfile();

  const [{ proyek: proyekList, pesanKosong }, { data: riwayatRows }] = await Promise.all([
    // Sumber daftar proyek (tracker / Taraco): lihat lib/laporanProyek.js.
    daftarProyekLaporan(supabase, profile.id),
    supabase
      .from("laporan_harian")
      .select("id, proyek_id, tanggal, deskripsi, status, foto_url, foto_urls, created_at, created_by, proyek:proyek_id(nama)")
      .eq("created_by", profile.id)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(HALAMAN),
  ]);

  // Proyek yang sudah dilaporkan hari ini — dipakai buat indikator di
  // dropdown Proyek supaya Supervisor gak perlu buka riwayat dulu buat tahu
  // proyek mana yang belum dilaporkan (lihat pola sama di app/supervisor/perbaikan).
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const sudahLaporIds = [...new Set((riwayatRows || []).filter((r) => r.tanggal === todayStr).map((r) => r.proyek_id))];

  const riwayat = await tambahUrlFoto(supabase, riwayatRows);

  return (
    <LaporanHarianForm
      proyekList={proyekList || []}
      pesanKosong={pesanKosong}
      riwayat={riwayat}
      hasMore={riwayat.length === HALAMAN}
      sudahLaporIds={sudahLaporIds}
      userId={profile.id}
    />
  );
}
