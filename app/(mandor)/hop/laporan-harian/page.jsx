import { getSessionProfile } from "@/lib/supabase/server";
import { syncProyekFromTaraco } from "@/lib/supabase/syncProyek";
import { proyekHop } from "@/lib/supabase/proyekHop";
import { supabaseAdmin } from "@/lib/laporanAkses";
import LaporanHarianForm from "@/app/(mandor)/supervisor/laporan-harian/LaporanHarianForm";

export const dynamic = "force-dynamic";

const HALAMAN = 30;

// Membuat laporan harian untuk Head of Production — form yang sama dengan
// Supervisor, tapi daftar proyeknya SEMUA proyek Kick Off Meeting + Production dari Taraco (bukan
// hanya yang ditugaskan ke akun ini). Dibaca/ditulis lewat service role
// (lib/laporanAkses.js); layout /hop sudah memastikan role-nya, dicek lagi di
// sini karena client admin melewati RLS.
export default async function LaporanHarianHopPage() {
  const { profile } = await getSessionProfile();
  if (profile?.role !== "HEAD_OF_PRODUCTION") return null;

  await syncProyekFromTaraco();
  const idProyek = [...(await proyekHop()).keys()];

  const [{ data: proyekList }, { data: riwayatRows }] = await Promise.all([
    supabaseAdmin.from("proyek").select("id, nama").in("id", idProyek).order("nama"),
    supabaseAdmin
      .from("laporan_harian")
      .select("id, proyek_id, tanggal, deskripsi, status, foto_url, created_at, created_by, proyek:proyek_id(nama)")
      .eq("created_by", profile.id)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(HALAMAN),
  ]);

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const sudahLaporIds = [...new Set((riwayatRows || []).filter((r) => r.tanggal === todayStr).map((r) => r.proyek_id))];

  const paths = (riwayatRows || []).filter((r) => r.foto_url).map((r) => r.foto_url);
  const { data: signed } = paths.length
    ? await supabaseAdmin.storage.from("progres").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries((signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));

  const riwayat = (riwayatRows || []).map((r) => ({
    ...r,
    fotoSignedUrl: r.foto_url ? urlMap[r.foto_url] || null : null,
  }));

  return (
    <LaporanHarianForm
      proyekList={proyekList || []}
      pesanKosong="Belum ada proyek Kick Off Meeting atau Production dari Taraco."
      riwayat={riwayat}
      sudahLaporIds={sudahLaporIds}
      userId={profile.id}
      homePath="/hop"
      peran="HEAD_OF_PRODUCTION"
    />
  );
}
