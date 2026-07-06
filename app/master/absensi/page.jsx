import { getSessionProfile } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import FotoLightbox from "@/components/FotoLightbox";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AbsensiMasterPage() {
  const { supabase } = await getSessionProfile();

  const today = new Date().toISOString().slice(0, 10);

  const { data: proyek } = await supabase
    .from("proyek")
    .select(
      "id, nama, lokasi, icon, mandor:mandor_id(id, name, telegram_chat_id)",
    )
    .eq("is_active", true)
    .order("nama");

  const proyekIds = (proyek || []).map((p) => p.id);

  // Absensi pribadi mandor (checkin_harian) — chat_id sama dengan yang dipakai saat absen
  const mandorChatIds = [
    ...new Set(
      (proyek || [])
        .filter((p) => p.mandor)
        .map((p) => String(p.mandor.telegram_chat_id ?? p.mandor.id)),
    ),
  ];
  const { data: checkins } = mandorChatIds.length
    ? await supabase
        .from("checkin_harian")
        .select("chat_id, checkout_at")
        .eq("tanggal", today)
        .in("chat_id", mandorChatIds)
    : { data: [] };
  const checkinMap = Object.fromEntries(
    (checkins || []).map((c) => [c.chat_id, c]),
  );

  const { data: absensi } = proyekIds.length
    ? await supabase
        .from("absensi_ringkas")
        .select("proyek_id, jumlah_hadir")
        .in("proyek_id", proyekIds)
        .eq("tanggal", today)
    : { data: [] };

  // Foto suasana proyek hari ini (bukti absensi) — ambil yang terbaru per proyek
  const { data: fotos } = proyekIds.length
    ? await supabase
        .from("progres_foto")
        .select("proyek_id, foto_url, created_at")
        .in("proyek_id", proyekIds)
        .eq("tanggal", today)
        .order("created_at", { ascending: false })
    : { data: [] };
  const fotoMap = {};
  for (const f of fotos || []) {
    if (!fotoMap[f.proyek_id]) fotoMap[f.proyek_id] = f.foto_url;
  }
  const fotoPaths = [...new Set(Object.values(fotoMap))];
  const { data: signed } = fotoPaths.length
    ? await supabase.storage.from("progres").createSignedUrls(fotoPaths, 3600)
    : { data: [] };
  const signedMap = Object.fromEntries(
    (signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]),
  );

  const absensiMap = Object.fromEntries(
    (absensi || []).map((a) => [a.proyek_id, a.jumlah_hadir]),
  );

  const totalHadir = (absensi || []).reduce(
    (sum, a) => sum + (a.jumlah_hadir || 0),
    0,
  );
  const proyekAbsen = (proyek || []).filter(
    (p) => absensiMap[p.id] == null,
  ).length;

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <h1 className="text-xl font-bold tracking-tight">Absensi</h1>
      <p className="mb-4 text-sm text-gray-500">
        {new Date().toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Total Hadir Hari Ini</p>
          <p className="text-3xl font-bold text-emerald-600">{totalHadir}</p>
          <p className="text-xs text-gray-400">orang</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Belum Absen</p>
          <p className="text-3xl font-bold text-amber-500">{proyekAbsen}</p>
          <p className="text-xs text-gray-400">proyek</p>
        </div>
      </div>

      {/* List per proyek */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-2.5">
          <h2 className="font-bold text-gray-700 text-sm">
            Per Proyek ({proyek?.length || 0})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(proyek || []).map((p) => {
            const hadir = absensiMap[p.id];
            const sudahAbsen = hadir != null;
            const mandorCheckin = p.mandor
              ? checkinMap[String(p.mandor.telegram_chat_id ?? p.mandor.id)]
              : null;
            const fotoUrl = fotoMap[p.id] ? signedMap[fotoMap[p.id]] : null;
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="icon-tile bg-brand-50 text-brand-600 !w-9 !h-9 shrink-0">
                  <Icon name={p.icon || "building"} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{p.nama}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {p.mandor?.name || "Belum ada mandor"} · {p.lokasi || "—"}
                  </p>
                  {p.mandor && (
                    <p
                      className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${
                        mandorCheckin ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                          mandorCheckin ? "bg-emerald-500" : "bg-amber-400"
                        }`}
                      />
                      <span className="truncate">
                        {mandorCheckin
                          ? mandorCheckin.checkout_at
                            ? `Mandor ${p.mandor.name} Hadir · sudah pulang`
                            : `Mandor ${p.mandor.name} Hadir`
                          : `Mandor ${p.mandor.name} belum absen`}
                      </span>
                    </p>
                  )}
                </div>
                {fotoUrl && (
                  <FotoLightbox
                    src={fotoUrl}
                    caption={`${p.nama} · hari ini`}
                    className="shrink-0"
                  >
                    <img
                      src={fotoUrl}
                      alt={`Foto ${p.nama} hari ini`}
                      className="h-12 w-12 rounded-lg border border-gray-200 object-cover"
                    />
                  </FotoLightbox>
                )}
                <div className="text-right shrink-0">
                  {sudahAbsen ? (
                    <>
                      <p className="text-lg font-bold text-emerald-600">
                        {hadir}
                      </p>
                      <p className="text-[10px] text-gray-400">orang hadir</p>
                    </>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                      Belum
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {(proyek || []).length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">
              Belum ada proyek aktif.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
