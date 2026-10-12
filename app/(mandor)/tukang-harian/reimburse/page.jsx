import { getSessionProfile } from "@/lib/supabase/server";
import ReimburseForm from "./ReimburseForm";

export const dynamic = "force-dynamic";

export default async function ReimbursePage() {
  const { profile, supabase } = await getSessionProfile();
  const { data: proyek } = profile.proyek_id
    ? await supabase
        .from("proyek")
        .select("id, nama")
        .eq("id", profile.proyek_id)
        .eq("is_active", true)
        .maybeSingle()
    : { data: null };

  // Riwayat pengajuan reimburse tukang harian ini (terbaru dulu)
  const { data: riwayat } = proyek
    ? await supabase
        .from("keuangan")
        .select("id, nominal, keterangan, status, catatan_tolak, created_at, dibaca_pemohon")
        .eq("proyek_id", proyek.id)
        .eq("jenis", "REIMBURSE")
        .eq("created_by", profile.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  // Tandai hasil approve/reject sudah dilihat supaya badge di dashboard hilang.
  const belumDibaca = (riwayat || []).filter((r) => !r.dibaca_pemohon).map((r) => r.id);
  if (belumDibaca.length > 0) {
    await supabase.from("keuangan").update({ dibaca_pemohon: true }).in("id", belumDibaca);
  }

  return <ReimburseForm proyek={proyek} riwayat={riwayat || []} />;
}
