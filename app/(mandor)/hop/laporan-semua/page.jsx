import { getSessionProfile } from "@/lib/supabase/server";
import { syncProyekFromTaraco } from "@/lib/supabase/syncProyek";
import { proyekHop } from "@/lib/supabase/proyekHop";
import { supabaseAdmin } from "@/lib/laporanAkses";
import LaporanHarianSemuaProyek from "@/components/LaporanHarianSemuaProyek";

export const dynamic = "force-dynamic";

// Laporan harian SEMUA proyek untuk Head of Production — hanya baca (membuat
// laporan ada di /hop/laporan-harian). Dibaca lewat service role karena RLS
// laporan_harian tidak mengenal role ini; layout /hop sudah memastikan role-nya,
// dan dicek lagi di sini karena client admin melewati RLS.
export default async function LaporanSemuaHopPage() {
  const { profile } = await getSessionProfile();
  if (profile?.role !== "HEAD_OF_PRODUCTION") return null;
  // Daftar proyek aktif disegarkan dari Taraco (biasanya dilakukan dashboard
  // Supervisor/Master; di sini supaya tidak bergantung pada mereka).
  await syncProyekFromTaraco();
  const idProyek = [...(await proyekHop()).keys()];
  return <LaporanHarianSemuaProyek supabase={supabaseAdmin} homePath="/hop" proyekIds={idProyek} />;
}
