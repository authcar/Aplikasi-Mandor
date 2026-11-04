import { getSessionProfile } from "@/lib/supabase/server";
import RekapAbsensiPegawai from "@/components/RekapAbsensiPegawai";

export const dynamic = "force-dynamic";

export default async function AbsensiPegawaiMasterPage({ searchParams }) {
  const { supabase } = await getSessionProfile();
  return (
    <RekapAbsensiPegawai
      supabase={supabase}
      basePath="/master/absensi-pegawai"
      homePath="/master"
      bulanParam={searchParams?.bulan}
    />
  );
}
