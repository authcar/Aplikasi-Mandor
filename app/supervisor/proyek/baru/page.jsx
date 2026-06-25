import { getSessionProfile } from "@/lib/supabase/server";
import ProyekForm from "./ProyekForm";

export const dynamic = "force-dynamic";

export default async function ProyekBaruPage() {
  const { supabase } = await getSessionProfile();
  // Daftar mandor yang bisa ditugaskan (RLS: profiles_list_mandor)
  const { data: mandors } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("role", "MANDOR")
    .order("name");
  return <ProyekForm mandors={mandors || []} />;
}
