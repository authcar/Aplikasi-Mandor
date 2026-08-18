import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import KunjunganList from "@/components/KunjunganList";
import { petakanKunjungan } from "@/lib/kunjungan";

export const dynamic = "force-dynamic";

const BATAS = 200;

// Rekap kunjungan SEMUA supervisor. Master boleh melihat semuanya lewat
// policy kunjungan_read (my_role() = 'MASTER'), jadi tidak ada .eq() di sini.
export default async function RekapKunjunganMasterPage() {
  const { supabase } = await getSessionProfile();

  const { data: rows } = await supabase
    .from("kunjungan_supervisor")
    .select(
      "id, proyek_id, mulai_at, selesai_at, status, catatan_sistem, akurasi_masuk, proyek:proyek_id(nama), profil:profile_id(name)"
    )
    .order("mulai_at", { ascending: false })
    .limit(BATAS);

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <h1 className="text-xl font-bold tracking-tight">Kunjungan Supervisor</h1>
      <p className="mb-4 text-sm text-gray-500">Absen masuk & keluar di lokasi proyek</p>

      <KunjunganList rows={petakanKunjungan(rows || [])} tampilkanSupervisor />
    </main>
  );
}
