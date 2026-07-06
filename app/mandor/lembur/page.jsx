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

  // Riwayat pengajuan lembur mandor ini (terbaru dulu)
  const { data: riwayat } = proyek
    ? await supabase
        .from("lembur")
        .select("id, jam, total, catatan, tanggal, status, created_at")
        .eq("proyek_id", proyek.id)
        .eq("created_by", profile.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  return <LemburForm proyek={proyek} riwayat={riwayat || []} />;
}
