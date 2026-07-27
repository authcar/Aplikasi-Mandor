import { getSessionProfile } from "@/lib/supabase/server";
import ReimburseForm from "./ReimburseForm";

export const dynamic = "force-dynamic";

const HALAMAN = 10;

export default async function ReimbursePage() {
  const { profile, supabase } = await getSessionProfile();

  const { data: proyeks } = await supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
    .eq("is_active", true)
    .order("nama");

  // Riwayat pengajuan reimburse mandor ini di semua proyeknya (terbaru dulu).
  const { data: riwayat } = await supabase
    .from("keuangan")
    .select("id, nominal, keterangan, status, catatan_tolak, created_at, dibaca_pemohon, proyek:proyek_id(nama)")
    .eq("jenis", "REIMBURSE")
    .eq("created_by", profile.id)
    .order("created_at", { ascending: false })
    .limit(HALAMAN);

  const daftar = (riwayat || []).map((r) => ({ ...r, proyek: r.proyek?.nama || null }));

  // Tandai hasil approve/reject sudah dilihat supaya badge di dashboard hilang.
  const belumDibaca = (riwayat || []).filter((r) => !r.dibaca_pemohon).map((r) => r.id);
  if (belumDibaca.length > 0) {
    await supabase.from("keuangan").update({ dibaca_pemohon: true }).in("id", belumDibaca);
  }

  return <ReimburseForm proyeks={proyeks || []} riwayat={daftar} />;
}
