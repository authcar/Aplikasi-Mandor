import { getSessionProfile } from "@/lib/supabase/server";
import KasbonForm from "./KasbonForm";
import { getProyekMandor } from "@/lib/supabase/proyekMandor";

export const dynamic = "force-dynamic";

export default async function KasbonMandorPage() {
  const { profile, supabase } = await getSessionProfile();

  const [proyekList, { data: riwayat }] = await Promise.all([
    getProyekMandor(supabase, profile.id),
    supabase
      .from("keuangan")
      .select("id, nominal, keterangan, status, catatan_tolak, created_at, dibaca_pemohon")
      .eq("jenis", "KASBON")
      .eq("created_by", profile.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Tandai hasil approve/reject sudah dilihat supaya badge di dashboard hilang.
  const belumDibaca = (riwayat || []).filter((r) => !r.dibaca_pemohon).map((r) => r.id);
  if (belumDibaca.length > 0) {
    await supabase.from("keuangan").update({ dibaca_pemohon: true }).in("id", belumDibaca);
  }

  return (
    <KasbonForm proyekList={proyekList} riwayat={riwayat || []} />
  );
}
