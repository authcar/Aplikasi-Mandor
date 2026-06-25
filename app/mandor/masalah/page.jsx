import { getSessionProfile } from "@/lib/supabase/server";
import MasalahForm from "./MasalahForm";

export const dynamic = "force-dynamic";

export default async function MasalahPage({ searchParams }) {
  const { profile, supabase } = await getSessionProfile();
  let q = supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
    .eq("is_active", true);
  q = searchParams?.proyek ? q.eq("id", searchParams.proyek) : q.order("nama").limit(1);
  const { data: proyek } = await q.maybeSingle();
  return <MasalahForm proyek={proyek} />;
}
