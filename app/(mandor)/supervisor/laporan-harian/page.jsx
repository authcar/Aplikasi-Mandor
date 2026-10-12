import { getSessionProfile } from "@/lib/supabase/server";
import LaporanHarianForm from "./LaporanHarianForm";

export const dynamic = "force-dynamic";

const HALAMAN = 30;

export default async function LaporanHarianPage() {
  const { profile, supabase } = await getSessionProfile();

  const [{ data: proyekList }, { data: riwayatRows }] = await Promise.all([
    supabase.from("proyek").select("id, nama").eq("supervisor_id", profile.id).eq("is_active", true).order("nama"),
    supabase
      .from("laporan_harian")
      .select("id, proyek_id, tanggal, deskripsi, status, foto_url, created_at, proyek:proyek_id(nama)")
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

  const paths = (riwayatRows || []).filter((r) => r.foto_url).map((r) => r.foto_url);
  const { data: signed } = paths.length
    ? await supabase.storage.from("progres").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries(
    (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
  );

  const riwayat = (riwayatRows || []).map((r) => ({
    ...r,
    fotoSignedUrl: r.foto_url ? urlMap[r.foto_url] || null : null,
  }));

  return (
    <LaporanHarianForm
      proyekList={proyekList || []}
      riwayat={riwayat}
      hasMore={riwayat.length === HALAMAN}
      sudahLaporIds={sudahLaporIds}
    />
  );
}
