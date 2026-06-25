import { getSessionProfile } from "@/lib/supabase/server";
import ReimburseForm from "./ReimburseForm";

export const dynamic = "force-dynamic";

export default async function ReimbursePage() {
  const { profile, supabase } = await getSessionProfile();
  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
    .eq("is_active", true)
    .limit(1)
    .single();
  return <ReimburseForm proyek={proyek} />;
}
