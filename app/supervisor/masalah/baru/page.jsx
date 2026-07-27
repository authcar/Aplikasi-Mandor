import { getSessionProfile } from "@/lib/supabase/server";
import MasalahForm from "./MasalahForm";

export const dynamic = "force-dynamic";

export default async function MasalahBaruSupervisorPage() {
  const { profile, supabase } = await getSessionProfile();

  const [{ data: proyeks }, { data: rows }] = await Promise.all([
    supabase
      .from("proyek")
      .select("id, nama")
      .eq("supervisor_id", profile.id)
      .eq("is_active", true)
      .order("nama"),
    supabase
      .from("masalah")
      .select("id, judul, material, jumlah, satuan, urgensi, deskripsi, status, created_at, proyek(nama)")
      .eq("created_by", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

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
