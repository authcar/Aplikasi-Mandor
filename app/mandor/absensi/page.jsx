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

  const { data: tukang } = await supabase
    .from("tukang")
    .select("id, nama, jabatan")
    .eq("proyek_id", proyek?.id)
    .eq("is_active", true)
    .order("nama");

  const { data: sudah } = await supabase
    .from("absensi")
    .select("tukang_id, hadir")
    .eq("proyek_id", proyek?.id)
    .eq("tanggal", today);

  const hadirAwal = (sudah || []).filter((s) => s.hadir).map((s) => s.tukang_id);

  return (
    <RollCall
      proyek={proyek}
      tukang={tukang || []}
      hadirAwal={hadirAwal}
    />
  );
}
