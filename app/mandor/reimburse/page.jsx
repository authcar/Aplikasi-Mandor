import { getSessionProfile } from "@/lib/supabase/server";
import ReimburseForm from "./ReimburseForm";

export const dynamic = "force-dynamic";

export default async function ReimbursePage({ searchParams }) {
  const { profile, supabase } = await getSessionProfile();
  let q = supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
    .eq("is_active", true);
  q = searchParams?.proyek ? q.eq("id", searchParams.proyek) : q.order("nama").limit(1);
  const { data: proyek } = await q.maybeSingle();

  // Riwayat pengajuan reimburse mandor ini (terbaru dulu)
  const { data: riwayat } = proyek
    ? await supabase
        .from("keuangan")
        .select("id, nominal, keterangan, status, created_at")
        .eq("proyek_id", proyek.id)
        .eq("jenis", "REIMBURSE")
        .eq("created_by", profile.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  return <ReimburseForm proyek={proyek} riwayat={riwayat || []} />;
}
