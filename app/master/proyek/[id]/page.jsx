import { getSessionProfile } from "@/lib/supabase/server";
import ProyekDetail from "./ProyekDetail";

export const dynamic = "force-dynamic";

export default async function ProyekDetailMasterPage({ params }) {
  const { supabase } = await getSessionProfile();
  const { id } = params;

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: proyek }, { data: mandors }, { data: absensi }] = await Promise.all([
    supabase.from("proyek").select("id, nama, lokasi, icon, mandor_id, nilai_proyek").eq("id", id).single(),
    supabase.from("profiles").select("id, name").eq("role", "MANDOR").order("name"),
    supabase.from("absensi_ringkas").select("jumlah_hadir").eq("proyek_id", id).eq("tanggal", today).maybeSingle(),
  ]);

  if (!proyek) return <p className="p-6">Proyek tidak ditemukan.</p>;

  return <ProyekDetail proyek={proyek} mandors={mandors || []} jumlahHadir={absensi?.jumlah_hadir ?? null} />;
}
