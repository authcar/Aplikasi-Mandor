import { getSessionProfile } from "@/lib/supabase/server";
import ProyekDetail from "./ProyekDetail";

export const dynamic = "force-dynamic";

export default async function ProyekDetailPage({ params }) {
  const { supabase } = await getSessionProfile();
  const { id } = params;

  const [{ data: proyek }, { data: tukang }, { data: mandors }] = await Promise.all([
    supabase.from("proyek").select("id, nama, lokasi, icon, mandor_id").eq("id", id).single(),
    supabase.from("tukang").select("id, nama, jabatan, upah_harian, is_active").eq("proyek_id", id).order("nama"),
    supabase.from("profiles").select("id, name").eq("role", "MANDOR").order("name"),
  ]);

  if (!proyek) return <p className="p-6">Proyek tidak ditemukan.</p>;

  return <ProyekDetail proyek={proyek} tukangAwal={tukang || []} mandors={mandors || []} />;
}
