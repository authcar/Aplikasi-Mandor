import { getSessionProfile } from "@/lib/supabase/server";
import ProyekForm from "./ProyekForm";

export const dynamic = "force-dynamic";

export default async function ProyekBaruMasterPage() {
  const { supabase } = await getSessionProfile();
  const [{ data: mandors }, { data: supervisors }] = await Promise.all([
    supabase.from("profiles").select("id, name").eq("role", "MANDOR").order("name"),
    supabase.from("profiles").select("id, name").eq("role", "SUPERVISOR").order("name"),
  ]);
  return <ProyekForm mandors={mandors || []} supervisors={supervisors || []} />;
}
