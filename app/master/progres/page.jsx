import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import FotoLightbox from "@/components/FotoLightbox";

export const dynamic = "force-dynamic";

const LIMIT_FOTO = 90;

export default async function ProgresFeedPage() {
  const { supabase } = await getSessionProfile();

  const { data: fotos } = await supabase
    .from("progres_foto")
    .select("id, foto_url, tanggal, created_at, proyek:proyek_id(nama, icon)")
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIMIT_FOTO);

  const paths = [...new Set((fotos || []).map((f) => f.foto_url))];
  const { data: signed } = paths.length
    ? await supabase.storage.from("progres").createSignedUrls(paths, 3600)
    : { data: [] };
  const urlMap = Object.fromEntries(
    (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]),
  );

  // Kelompokkan per tanggal (terbaru dulu)
  const perTanggal = [];
  for (const f of fotos || []) {
    const url = urlMap[f.foto_url];
    if (!url) continue;
    const last = perTanggal[perTanggal.length - 1];
    if (last && last.tanggal === f.tanggal) last.items.push({ ...f, url });
    else perTanggal.push({ tanggal: f.tanggal, items: [{ ...f, url }] });
  }

  const labelTanggal = (tgl) =>
    new Date(`${tgl}T00:00:00`).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const jamFoto = (ts) =>
    new Date(ts).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <h1 className="text-xl font-bold tracking-tight">Progres Harian</h1>
      <p className="mb-4 text-sm text-gray-500">Foto suasana semua proyek</p>

      {perTanggal.map((grup) => (
        <div key={grup.tanggal} className="card mb-3 p-4">
          <p className="mb-2 text-sm font-bold capitalize text-gray-700">
            {labelTanggal(grup.tanggal)}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {grup.items.map((f, i) => (
              <FotoLightbox
                key={f.id}
                items={grup.items.map((ff) => ({
                  src: ff.url,
                  caption: `${ff.proyek?.nama || "Proyek"} · ${jamFoto(ff.created_at)}`,
                }))}
                index={i}
              >
                <img
                  src={f.url}
                  alt={`Foto ${f.proyek?.nama || "proyek"}`}
                  className="aspect-square w-full rounded-lg border border-gray-200 object-cover"
                />
                <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-gray-500">
                  <Icon
                    name={f.proyek?.icon || "building"}
                    className="h-3 w-3 shrink-0 text-gray-400"
                  />
                  <span className="truncate">{f.proyek?.nama || "—"}</span>
                </p>
              </FotoLightbox>
            ))}
          </div>
        </div>
      ))}

      {perTanggal.length === 0 && (
        <div className="card p-8 text-center text-sm text-gray-400">
          Belum ada foto suasana proyek.
        </div>
      )}
    </main>
  );
}
