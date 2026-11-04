import { getSessionProfile } from "@/lib/supabase/server";
import RekapAbsensiPegawai from "@/components/RekapAbsensiPegawai";

export const dynamic = "force-dynamic";

export default async function AbsensiPegawaiFinancePage({ searchParams }) {
  const { supabase } = await getSessionProfile();
  return (
    <RekapAbsensiPegawai
      supabase={supabase}
      basePath="/finance/absensi-pegawai"
      homePath="/finance"
      bulanParam={searchParams?.bulan}
    />
  );
}
