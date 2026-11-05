import { getSessionProfile } from "@/lib/supabase/server";
import LaporanHarianSemuaProyek from "@/components/LaporanHarianSemuaProyek";

export const dynamic = "force-dynamic";

// Laporan harian dari SEMUA proyek (semua Supervisor) — Master tidak perlu
// buka satu-satu halaman detail proyek untuk lihat laporan yang masuk.
export default async function LaporanHarianMasterPage() {
  const { supabase } = await getSessionProfile();
  return <LaporanHarianSemuaProyek supabase={supabase} homePath="/master" tandaiDibaca peran="MASTER" />;
}
