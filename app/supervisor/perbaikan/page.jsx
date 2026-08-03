import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import PerbaikanForm from "./PerbaikanForm";

export const dynamic = "force-dynamic";

// Checklist Perbaikan (defect list) — Supervisor melaporkan temuan perbaikan
// per proyek; Mandor proyek tsb mendapat notifikasi & menandai selesai.
export default async function PerbaikanSupervisorPage() {
  const { supabase } = await getSessionProfile();

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, mandor:mandor_id(name)")
    .eq("is_active", true)
    .order("nama");

  const proyekIds = (proyek || []).map((p) => p.id);
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const [{ data: rows }, { data: laporanHariIni }] = await Promise.all([
    // CANCELLED disembunyikan dari daftar aktif Supervisor (dibatalkan lewat
    // ikon X di card) — tetap tersimpan & muncul di riwayat Master.
    supabase
      .from("checklist_perbaikan")
      .select(
        "id, proyek_id, no, uraian, foto_url, foto_bukti_url, video_url, video_bukti_url, periode, status, dibaca_supervisor, created_at, proyek(nama)"
      )
      .neq("status", "CANCELLED")
      .order("proyek_id", { ascending: true })
      .order("no", { ascending: true }),
    // Proyek yang sudah dikirimi laporan harian hari ini — dipakai buat
    // indikator warna per proyek di Defect List (lihat PerbaikanForm).
    proyekIds.length
      ? supabase.from("laporan_harian").select("proyek_id").eq("tanggal", todayStr).in("proyek_id", proyekIds)
      : Promise.resolve({ data: [] }),
  ]);

  const sudahLaporIds = [...new Set((laporanHariIni || []).map((r) => r.proyek_id))];

  const paths = [
    ...(rows || []).filter((r) => r.foto_url).map((r) => r.foto_url),
    ...(rows || []).filter((r) => r.foto_bukti_url).map((r) => r.foto_bukti_url),
    ...(rows || []).filter((r) => r.video_url).map((r) => r.video_url),
    ...(rows || []).filter((r) => r.video_bukti_url).map((r) => r.video_bukti_url),
  ];
  const { data: signed } = paths.length
    ? await supabase.storage.from("perbaikan").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries(
    (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
  );

  const items = (rows || []).map((r) => ({
    id: r.id,
    proyek_id: r.proyek_id,
    no: r.no,
    uraian: r.uraian,
    periode: r.periode,
    status: r.status,
    dibaca_supervisor: r.dibaca_supervisor,
    created_at: r.created_at,
    proyek: r.proyek?.nama || "-",
    foto: r.foto_url ? urlMap[r.foto_url] || null : null,
    fotoBukti: r.foto_bukti_url ? urlMap[r.foto_bukti_url] || null : null,
    video: r.video_url ? urlMap[r.video_url] || null : null,
    videoBukti: r.video_bukti_url ? urlMap[r.video_bukti_url] || null : null,
  }));

  // Tandai bukti pengerjaan baru sudah dilihat supaya badge "Baru" hilang.
  const belumDibaca = items.filter((i) => !i.dibaca_supervisor).map((i) => i.id);
  if (belumDibaca.length > 0) {
    await supabase.from("checklist_perbaikan").update({ dibaca_supervisor: true }).in("id", belumDibaca);
  }

  const aktif = items.filter((i) => i.status !== "DONE").length;
  const menunggu = items.filter((i) => i.status === "PENDING_REVIEW").length;

  return (
    <main className="p-4 pb-10">
      <BackButton href="/supervisor" />
      <header className="mb-1">
        <h1 className="text-xl font-bold tracking-tight">Defect List</h1>
      </header>
      <p className="mb-4 text-sm text-gray-500">
        {aktif} item belum selesai
        {menunggu > 0 ? ` · ${menunggu} menunggu persetujuan Anda` : ""}
      </p>
      <PerbaikanForm proyeks={proyek || []} items={items} sudahLaporIds={sudahLaporIds} />
    </main>
  );
}
