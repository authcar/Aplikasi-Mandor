import { getSessionProfile } from "@/lib/supabase/server";
import ProyekDetail from "./ProyekDetail";

export const dynamic = "force-dynamic";

export default async function ProyekDetailMasterPage({ params }) {
  const { supabase } = await getSessionProfile();
  const { id } = params;

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: proyek }, { data: absensi }] = await Promise.all([
    supabase
      .from("proyek")
      .select("id, nama, lokasi, icon, nilai_proyek, mandor:mandor_id(name), supervisor:supervisor_id(name)")
      .eq("id", id)
      .single(),
    supabase.from("absensi_ringkas").select("jumlah_hadir").eq("proyek_id", id).eq("tanggal", today).maybeSingle(),
  ]);

  if (!proyek) return <p className="p-6">Proyek tidak ditemukan.</p>;

  return <ProyekDetail proyek={proyek} jumlahHadir={absensi?.jumlah_hadir ?? null} />;
}
