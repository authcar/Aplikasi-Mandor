import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import PerbaikanMandorList from "./PerbaikanMandorList";
import { gabungkanMediaPerbaikan } from "@/lib/perbaikanMedia";

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

  // Item yang di-assign manual (assigned_mandor_id) ke mandor LAIN harus
  // disembunyikan dari mandor resmi proyek ini — makanya item milik proyek
  // sendiri cuma ikut kalau assigned_mandor_id kosong (belum di-assign
  // spesifik ke siapa pun, jadi tetap tanggung jawab mandor resmi).
  const orParts = [`assigned_mandor_id.eq.${profile.id}`];
  if (proyekIds.length > 0)
    orParts.push(`and(assigned_mandor_id.is.null,proyek_id.in.(${proyekIds.join(",")}))`);

  const { data: rows } = await supabase
    .from("checklist_perbaikan")
    .select("id, proyek_id, no, uraian, foto_url, foto_bukti_url, video_url, video_bukti_url, foto_drive_file_id, foto_bukti_drive_file_id, video_drive_file_id, video_bukti_drive_file_id, periode, status, dibaca_mandor, catatan_tolak, created_at")
    .or(orParts.join(","))
    // CANCELLED (dibatalkan Supervisor) disembunyikan total dari Mandor —
    // sama pola dgn app/supervisor/perbaikan/page.jsx — tetap tercatat di
    // riwayat Master.
    .neq("status", "CANCELLED")
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

  const ids = (rows || []).map((r) => r.id);
  const { data: mediaRows } = ids.length
    ? await supabase.from("checklist_perbaikan_media").select("id, checklist_id, jenis, tipe, path, drive_file_id, urutan").in("checklist_id", ids)
    : { data: [] };

  const legacyPaths = [
    ...(rows || []).filter((r) => r.foto_url).map((r) => r.foto_url),
    ...(rows || []).filter((r) => r.foto_bukti_url).map((r) => r.foto_bukti_url),
    ...(rows || []).filter((r) => r.video_url).map((r) => r.video_url),
    ...(rows || []).filter((r) => r.video_bukti_url).map((r) => r.video_bukti_url),
  ];
  const mediaPaths = (mediaRows || []).map((m) => m.path).filter(Boolean);
  const paths = [...new Set([...legacyPaths, ...mediaPaths])];
  const { data: signed } = paths.length
    ? await supabase.storage.from("perbaikan").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries(
    (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
  );

  const merged = gabungkanMediaPerbaikan(rows, mediaRows, urlMap);
  const items = (rows || []).map((r, i) => ({
    ...r,
    ...merged[i],
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
