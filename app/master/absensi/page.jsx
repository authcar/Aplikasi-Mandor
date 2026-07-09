import { getSessionProfile } from "@/lib/supabase/server";
import { groupAbsensiTimPerHari } from "@/lib/format";
import BackButton from "@/components/BackButton";
import FotoLightbox from "@/components/FotoLightbox";
import RiwayatLaporanCard from "@/components/RiwayatLaporanCard";

export const dynamic = "force-dynamic";

export default async function AbsensiMasterPage() {
  const { supabase } = await getSessionProfile();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const mulaiRiwayat = new Date();
  mulaiRiwayat.setDate(mulaiRiwayat.getDate() - 30);
  const iso30HariLalu = mulaiRiwayat.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const [{ data: rows }, { data: fotoRows }, { data: riwayatRows }] = await Promise.all([
    supabase
      .from("absensi_tim")
      .select("tim, jumlah, kegiatan, urutan")
      .eq("tanggal", today)
      .order("urutan"),
    supabase
      .from("absensi_tim_foto")
      .select("id, foto_url")
      .eq("tanggal", today)
      .order("created_at"),
    supabase
      .from("absensi_tim")
      .select("tanggal, tim, jumlah, kegiatan, urutan")
      .gte("tanggal", iso30HariLalu)
      .lt("tanggal", today)
      .order("tanggal", { ascending: false })
      .order("urutan"),
  ]);

  const riwayat = groupAbsensiTimPerHari(riwayatRows);

  // Kelompokkan per tim (urutan dipertahankan)
  const tims = [];
  for (const r of rows || []) {
    const last = tims[tims.length - 1];
    if (last && last.tim === r.tim) last.lines.push(r);
    else tims.push({ tim: r.tim, lines: [r] });
  }

  // Baris bernama (jumlah null) dihitung 1 orang
  const totalOrang = (rows || []).reduce(
    (s, r) => s + (Number(r.jumlah) > 0 ? Number(r.jumlah) : 1),
    0
  );

  // Signed URL dokumentasi
  let fotos = [];
  if (fotoRows?.length) {
    const { data: signed } = await supabase.storage
      .from("absensi")
      .createSignedUrls(fotoRows.map((f) => f.foto_url), 3600);
    const urlMap = Object.fromEntries(
      (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])
    );
    fotos = fotoRows
      .map((f) => ({ id: f.id, url: urlMap[f.foto_url] }))
      .filter((f) => f.url);
  }

  const tglLabel = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <h1 className="text-xl font-bold tracking-tight">Absensi Harian Tukang</h1>
      <p className="mb-4 text-sm capitalize text-gray-500">{tglLabel}</p>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Total Orang Hari Ini</p>
          <p className="text-3xl font-bold text-emerald-600">{totalOrang}</p>
          <p className="text-xs text-gray-400">orang</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Jumlah Tim</p>
          <p className="text-3xl font-bold text-brand">{tims.length}</p>
          <p className="text-xs text-gray-400">tim</p>
        </div>
      </div>

      {/* Laporan per tim */}
      {tims.length > 0 ? (
        <div className="space-y-3">
          {tims.map((t) => {
            const orangTim = t.lines.reduce(
              (s, l) => s + (Number(l.jumlah) > 0 ? Number(l.jumlah) : 1),
              0
            );
            return (
              <div key={t.tim} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                  <h2 className="font-bold text-gray-700 text-sm">{t.tim}</h2>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {orangTim} orang
                  </span>
                </div>
                <ul className="divide-y divide-gray-50 px-4 py-2">
                  {t.lines.map((l, i) => (
                    <li key={i} className="flex items-start gap-2 py-1.5 text-sm text-gray-600">
                      <span className="mt-0.5 shrink-0 text-gray-300">–</span>
                      <span>
                        {Number(l.jumlah) > 0 && (
                          <span className="font-semibold text-gray-800">{Number(l.jumlah)} orang </span>
                        )}
                        {l.kegiatan}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-8 text-center text-sm text-gray-400">
          Supervisor belum mengisi absensi hari ini.
        </div>
      )}

      {/* Dokumentasi */}
      {fotos.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 font-bold text-gray-700">Dokumentasi ({fotos.length})</h2>
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f, i) => (
              <FotoLightbox key={f.id} src={f.url} caption={`Dokumentasi ${i + 1} · ${tglLabel}`}>
                <img
                  src={f.url}
                  alt={`dokumentasi absensi ${i + 1}`}
                  className="aspect-square w-full rounded-xl border border-gray-200 object-cover"
                />
              </FotoLightbox>
            ))}
          </div>
        </>
      )}

      <RiwayatLaporanCard riwayat={riwayat} />
    </main>
  );
}
