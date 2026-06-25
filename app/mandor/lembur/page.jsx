import { getSessionProfile } from "@/lib/supabase/server";
import LemburForm from "./LemburForm";

export const dynamic = "force-dynamic";

export default async function LemburPage({ searchParams }) {
  const { profile, supabase } = await getSessionProfile();
  let q = supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
    .eq("is_active", true);
  q = searchParams?.proyek ? q.eq("id", searchParams.proyek) : q.order("nama").limit(1);
  const { data: proyek } = await q.maybeSingle();
  const { data: tukang } = await supabase
    .from("tukang")
    .select("id, nama, upah_harian")
    .eq("proyek_id", proyek?.id)
    .eq("is_active", true)
    .order("nama");
  return <LemburForm proyek={proyek} tukang={tukang || []} />;
}
