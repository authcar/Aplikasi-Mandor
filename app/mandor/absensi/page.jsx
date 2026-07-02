import { getSessionProfile } from "@/lib/supabase/server";
import RollCall from "./RollCall";

export const dynamic = "force-dynamic";

export default async function AbsensiPage({ searchParams }) {
  const { profile, supabase } = await getSessionProfile();
  const today = new Date().toISOString().slice(0, 10);

  let q = supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
    .eq("is_active", true);
  q = searchParams?.proyek ? q.eq("id", searchParams.proyek) : q.order("nama").limit(1);
  const { data: proyek } = await q.maybeSingle();

  const { data: sudah } = await supabase
    .from("absensi_ringkas")
    .select("jumlah_hadir")
    .eq("proyek_id", proyek?.id)
    .eq("tanggal", today)
    .maybeSingle();

  const jumlahHadirAwal = sudah ? sudah.jumlah_hadir : null;

  return (
    <RollCall
      proyek={proyek}
      jumlahHadirAwal={jumlahHadirAwal}
    />
  );
}
