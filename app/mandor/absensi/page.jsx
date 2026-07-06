import { getSessionProfile } from "@/lib/supabase/server";
import RollCall from "./RollCall";

export const dynamic = "force-dynamic";

export default async function AbsensiPage({ searchParams }) {
  const { profile, supabase } = await getSessionProfile();
  const today = new Date().toISOString().slice(0, 10);

  let q = supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
    .eq("is_active", true);
  q = searchParams?.proyek ? q.eq("id", searchParams.proyek) : q.order("nama").limit(1);
  const { data: proyek } = await q.maybeSingle();

  const { data: sudah } = await supabase
    .from("absensi_ringkas")
    .select("jumlah_hadir")
    .eq("proyek_id", proyek?.id)
    .eq("tanggal", today)
    .maybeSingle();

  const jumlahHadirAwal = sudah ? sudah.jumlah_hadir : null;

  // Foto suasana yang sudah ter-upload hari ini (bisa dihapus di hari yang sama)
  const { data: fotoRows } = proyek?.id
    ? await supabase
        .from("progres_foto")
        .select("id, foto_url")
        .eq("proyek_id", proyek.id)
        .eq("tanggal", today)
        .order("created_at", { ascending: false })
    : { data: [] };

  let fotoTerupload = [];
  if (fotoRows?.length) {
    const { data: signed } = await supabase.storage
      .from("progres")
      .createSignedUrls(fotoRows.map((f) => f.foto_url), 3600);
    const urlMap = Object.fromEntries(
      (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
    );
    fotoTerupload = fotoRows
      .map((f) => ({ id: f.id, path: f.foto_url, url: urlMap[f.foto_url] }))
      .filter((f) => f.url);
  }

  return (
    <RollCall
      proyek={proyek}
      jumlahHadirAwal={jumlahHadirAwal}
      fotoTerupload={fotoTerupload}
    />
  );
}
