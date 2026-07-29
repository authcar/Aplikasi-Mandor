import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import PerbaikanMandorList from "./PerbaikanMandorList";

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
      .select("id, no, uraian, foto_url, periode, status, dibaca_tukang_harian, created_at")
      .eq("proyek_id", proyek.id)
      .order("no", { ascending: true });

    for (const r of rows || []) {
      let foto = null;
      if (r.foto_url) {
        const { data } = await supabase.storage
          .from("perbaikan")
          .createSignedUrl(r.foto_url, 3600);
        foto = data?.signedUrl || null;
      }
      items.push({ ...r, foto });
    }

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
