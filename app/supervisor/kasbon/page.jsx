import { getSessionProfile } from "@/lib/supabase/server";
import KasbonForm from "./KasbonForm";

export const dynamic = "force-dynamic";

export default async function KasbonSupervisorPage() {
  const { profile, supabase } = await getSessionProfile();

  const [{ data: proyekList }, { data: riwayat }] = await Promise.all([
    supabase.from("proyek").select("id, nama").eq("supervisor_id", profile.id).eq("is_active", true).order("nama"),
    supabase
      .from("keuangan")
      .select("id, nominal, keterangan, status, created_at")
      .eq("jenis", "KASBON")
      .eq("created_by", profile.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <KasbonForm proyekList={proyekList || []} riwayat={riwayat || []} />
  );
}
