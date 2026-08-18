import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import KunjunganList from "@/components/KunjunganList";
import { petakanKunjungan } from "@/lib/kunjungan";

export const dynamic = "force-dynamic";

const BATAS = 100;

// Riwayat kunjungan milik Supervisor yang login. Penyaringan ke barisnya
// sendiri dilakukan RLS (policy kunjungan_read), .eq() di sini cuma
// mempertegas — kalau policy-nya berubah, halaman ini tidak ikut bocor.
export default async function RiwayatKunjunganPage() {
  const { profile, supabase } = await getSessionProfile();

  const { data: rows } = await supabase
    .from("kunjungan_supervisor")
    .select("id, proyek_id, mulai_at, selesai_at, status, catatan_sistem, akurasi_masuk, proyek:proyek_id(nama)")
    .eq("profile_id", profile.id)
    .order("mulai_at", { ascending: false })
    .limit(BATAS);

  return (
    <main className="p-4 pb-8">
      <BackButton href="/supervisor" />
      <h1 className="text-xl font-bold tracking-tight">Riwayat Kunjungan</h1>
      <p className="mb-4 text-sm text-gray-500">Absen masuk & keluar di proyek</p>

      <KunjunganList rows={petakanKunjungan(rows || [])} />
    </main>
  );
}
