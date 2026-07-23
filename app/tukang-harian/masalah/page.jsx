import { getSessionProfile } from "@/lib/supabase/server";
import MasalahForm from "./MasalahForm";

export const dynamic = "force-dynamic";

export default async function MasalahPage() {
  const { profile, supabase } = await getSessionProfile();

  const [{ data: proyeks }, { data: rows }] = await Promise.all([
    profile.proyek_id
      ? supabase
          .from("proyek")
          .select("id, nama")
          .eq("id", profile.proyek_id)
          .eq("is_active", true)
          .order("nama")
      : Promise.resolve({ data: [] }),
    supabase
      .from("masalah")
      .select("id, judul, material, jumlah, satuan, urgensi, deskripsi, status, created_at, dibaca_pelapor, proyek(nama)")
      .eq("created_by", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Tandai perubahan status sudah dilihat supaya badge di dashboard hilang.
  const belumDibaca = (rows || []).filter((r) => !r.dibaca_pelapor).map((r) => r.id);
  if (belumDibaca.length > 0) {
    await supabase.from("masalah").update({ dibaca_pelapor: true }).in("id", belumDibaca);
  }

  const laporan = (rows || []).map((r) => ({
    id: r.id,
    judul: r.judul,
    material: r.material || r.judul,
    jumlah: r.jumlah,
    satuan: r.satuan,
    urgensi: r.urgensi,
    catatan: r.deskripsi,
    status: r.status,
    proyek: r.proyek?.nama || null,
  }));

  return <MasalahForm proyeks={proyeks || []} laporan={laporan} />;
}
