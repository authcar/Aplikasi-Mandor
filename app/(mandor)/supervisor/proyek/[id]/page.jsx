import { getSessionProfile } from "@/lib/supabase/server";
import { tambahUrlFoto } from "@/lib/laporanFoto";
import ProyekDetail from "./ProyekDetail";

export const dynamic = "force-dynamic";

const HALAMAN = 30;

export default async function ProyekDetailPage({ params }) {
  const { profile, supabase } = await getSessionProfile();
  const { id } = params;

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: proyek }, { data: absensi }, { data: riwayatRows }] = await Promise.all([
    supabase
      .from("proyek")
      .select("id, nama, lokasi, icon, mandor:mandor_id(name)")
      .eq("id", id)
      .single(),
    supabase
      .from("absensi_ringkas")
      .select("jumlah_hadir, tidak_ada_pengerjaan")
      .eq("proyek_id", id)
      .eq("tanggal", today)
      .maybeSingle(),
    supabase
      .from("laporan_harian")
      .select("id, proyek_id, tanggal, deskripsi, status, foto_url, foto_urls, created_at, created_by")
      .eq("proyek_id", id)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(HALAMAN),
  ]);

  if (!proyek) return <p className="p-6">Proyek tidak ditemukan.</p>;

  const riwayat = (await tambahUrlFoto(supabase, riwayatRows)).map((r) => ({
    ...r,
    proyek: { nama: proyek.nama },
  }));

  return (
    <ProyekDetail
      proyek={proyek}
      jumlahHadir={absensi?.jumlah_hadir ?? null}
      tidakAdaPengerjaan={absensi?.tidak_ada_pengerjaan ?? false}
      riwayat={riwayat}
      userId={profile?.id ?? null}
    />
  );
}
