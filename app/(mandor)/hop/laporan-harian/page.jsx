import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { syncProyekFromTaraco } from "@/lib/supabase/syncProyek";
import LaporanHarianSemuaProyek from "@/components/LaporanHarianSemuaProyek";

export const dynamic = "force-dynamic";

// Laporan harian semua proyek untuk Head of Production — hanya baca. Dibaca
// lewat service role karena RLS laporan_harian tidak mengenal role ini; layout
// /hop sudah memastikan role-nya, dan dicek lagi di sini karena client admin
// melewati RLS.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function LaporanHarianHopPage() {
  const { profile } = await getSessionProfile();
  if (profile?.role !== "HEAD_OF_PRODUCTION") return null;
  // Daftar proyek aktif disegarkan dari Taraco (biasanya dilakukan dashboard
  // Supervisor/Master; di sini supaya tidak bergantung pada mereka).
  await syncProyekFromTaraco();
  return <LaporanHarianSemuaProyek supabase={supabaseAdmin} homePath="/hop" />;
}
