import { getSessionProfile } from "@/lib/supabase/server";
import LemburForm from "./LemburForm";

export const dynamic = "force-dynamic";

export default async function LemburPage() {
  const { profile, supabase } = await getSessionProfile();
  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
    .eq("is_active", true)
    .limit(1)
    .single();
  const { data: tukang } = await supabase
    .from("tukang")
    .select("id, nama, upah_harian")
    .eq("proyek_id", proyek?.id)
    .eq("is_active", true)
    .order("nama");
  return <LemburForm proyek={proyek} tukang={tukang || []} />;
}
