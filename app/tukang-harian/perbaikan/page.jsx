import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import PerbaikanMandorList from "./PerbaikanMandorList";
import { gabungkanMediaPerbaikan } from "@/lib/perbaikanMedia";

export const dynamic = "force-dynamic";

// Checklist Perbaikan milik proyek tukang harian ini.
// Membuka halaman ini otomatis menandai item sebagai sudah dibaca (notifikasi hilang).
export default async function PerbaikanTukangHarianPage() {
  const { profile, supabase } = await getSessionProfile();

  const { data: proyek } = profile.proyek_id
    ? await supabase
        .from("proyek")
        .select("id, nama")
        .eq("id", profile.proyek_id)
        .eq("is_active", true)
        .maybeSingle()
    : { data: null };

  let items = [];
  if (proyek) {
    const { data: rows } = await supabase
      .from("checklist_perbaikan")
      .select("id, no, uraian, foto_url, video_url, foto_drive_file_id, video_drive_file_id, periode, status, dibaca_tukang_harian, created_at")
      .eq("proyek_id", proyek.id)
      .order("no", { ascending: true });

    const ids = (rows || []).map((r) => r.id);
    const { data: mediaRows } = ids.length
      ? await supabase.from("checklist_perbaikan_media").select("id, checklist_id, jenis, tipe, path, drive_file_id, urutan").in("checklist_id", ids)
      : { data: [] };

    const legacyPaths = [
      ...(rows || []).filter((r) => r.foto_url).map((r) => r.foto_url),
      ...(rows || []).filter((r) => r.video_url).map((r) => r.video_url),
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
    items = (rows || []).map((r, i) => ({
      ...r,
      mediaTemuan: merged[i].mediaTemuan,
    }));

    // Tandai sudah dibaca (khusus Tukang Harian) supaya badge notifikasi di
    // dashboard-nya hilang — terpisah dari dibaca_mandor milik Mandor.
    const belumDibaca = items.filter((i) => !i.dibaca_tukang_harian).map((i) => i.id);
    if (belumDibaca.length > 0) {
      await supabase
        .from("checklist_perbaikan")
        .update({ dibaca_tukang_harian: true })
        .in("id", belumDibaca);
    }
  }

  return (
    <main className="p-4 pb-10">
      <BackButton href={`/tukang-harian${proyek ? `?proyek=${proyek.id}` : ""}`} />
      <header className="mb-1">
        <h1 className="text-xl font-bold tracking-tight">Defect List</h1>
      </header>
      <p className="mb-4 text-sm text-gray-500">{proyek?.nama || "-"}</p>

      {!proyek ? (
        <p className="p-6 text-center text-gray-500">Belum ada proyek aktif.</p>
      ) : (
        <PerbaikanMandorList items={items} />
      )}
    </main>
  );
}
