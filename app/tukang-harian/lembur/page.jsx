import { getSessionProfile } from "@/lib/supabase/server";
import LemburForm from "./LemburForm";

export const dynamic = "force-dynamic";

export default async function LemburPage() {
  const { profile, supabase } = await getSessionProfile();
  const { data: proyek } = profile.proyek_id
    ? await supabase
        .from("proyek")
        .select("id, nama")
        .eq("id", profile.proyek_id)
        .eq("is_active", true)
        .maybeSingle()
    : { data: null };

  // Riwayat pengajuan lembur tukang harian ini (terbaru dulu)
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
