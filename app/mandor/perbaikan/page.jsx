import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import PerbaikanMandorList from "./PerbaikanMandorList";

export const dynamic = "force-dynamic";

// Checklist Perbaikan dari SEMUA proyek yang dipegang mandor ini sekaligus
// (bukan per-proyek) — nama proyek ditampilkan di tiap card supaya mandor
// tidak perlu bolak-balik ganti proyek untuk melihat semuanya. Juga
// mencakup item yang di-assign manual ke mandor ini lewat
// checklist_perbaikan.assigned_mandor_id (fallback kalau proyek.mandor_id
// kosong/salah — lihat supabase/add_checklist_assigned_mandor.sql), walau
// proyeknya bukan proyek resmi mandor ini.
// Membuka halaman ini otomatis menandai item sebagai sudah dibaca (notifikasi hilang).
export default async function PerbaikanMandorPage() {
  const { profile, supabase } = await getSessionProfile();

  const { data: proyekList } = await supabase
    .from("proyek")
    .select("id, nama")
    .eq("mandor_id", profile.id)
    .eq("is_active", true)
    .order("nama");

  const proyeks = proyekList || [];
  const proyekMap = Object.fromEntries(proyeks.map((p) => [p.id, p.nama]));
  const proyekIds = proyeks.map((p) => p.id);

  const orParts = [`assigned_mandor_id.eq.${profile.id}`];
  if (proyekIds.length > 0) orParts.push(`proyek_id.in.(${proyekIds.join(",")})`);

  const { data: rows } = await supabase
    .from("checklist_perbaikan")
    .select("id, proyek_id, no, uraian, foto_url, foto_bukti_url, periode, status, dibaca_mandor, catatan_tolak, created_at")
    .or(orParts.join(","))
    .order("created_at", { ascending: false });

  // Nama proyek utk item yang di-assign manual ke proyek di luar daftar
  // proyek resmi mandor ini (proyekMap di atas belum tentu mencakupnya).
  const rowProyekIds = [...new Set((rows || []).map((r) => r.proyek_id))];
  const missingIds = rowProyekIds.filter((id) => !(id in proyekMap));
  let extraMap = {};
  if (missingIds.length > 0) {
    const { data: extra } = await supabase.from("proyek").select("id, nama").in("id", missingIds);
    extraMap = Object.fromEntries((extra || []).map((p) => [p.id, p.nama]));
  }
  const namaProyek = { ...proyekMap, ...extraMap };

  const paths = [
    ...(rows || []).filter((r) => r.foto_url).map((r) => r.foto_url),
    ...(rows || []).filter((r) => r.foto_bukti_url).map((r) => r.foto_bukti_url),
  ];
  const { data: signed } = paths.length
    ? await supabase.storage.from("perbaikan").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries(
    (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
  );

  const items = (rows || []).map((r) => ({
    ...r,
    foto: r.foto_url ? urlMap[r.foto_url] || null : null,
    fotoBukti: r.foto_bukti_url ? urlMap[r.foto_bukti_url] || null : null,
    proyek: namaProyek[r.proyek_id] || "-",
  }));

  // Tandai sudah dibaca supaya badge notifikasi di dashboard hilang.
  const belumDibaca = items.filter((i) => !i.dibaca_mandor).map((i) => i.id);
  if (belumDibaca.length > 0) {
    await supabase
      .from("checklist_perbaikan")
      .update({ dibaca_mandor: true })
      .in("id", belumDibaca);
  }

  return (
    <main className="p-4 pb-10">
      <BackButton href="/mandor" />
      <header className="mb-1">
        <h1 className="text-xl font-bold tracking-tight">Defect List</h1>
      </header>
      <p className="mb-4 text-sm text-gray-500">Semua proyek Anda</p>

      {proyeks.length === 0 && items.length === 0 ? (
        <p className="p-6 text-center text-gray-500">Belum ada proyek aktif.</p>
      ) : (
        <PerbaikanMandorList items={items} />
      )}
    </main>
  );
}
