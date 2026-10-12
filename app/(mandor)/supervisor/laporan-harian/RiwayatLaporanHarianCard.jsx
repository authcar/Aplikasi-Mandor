"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

const STATUS_BADGE = {
  ON_PROGRESS: { label: "Sedang Dikerjakan", cls: "bg-blue-100 text-blue-700" },
  DONE: { label: "Selesai", cls: "bg-green-100 text-green-700" },
  PERBAIKAN: { label: "Perlu Perbaikan", cls: "bg-red-100 text-red-700" },
};

const labelTanggal = (tgl) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

const jamnya = (ts) =>
  new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

// Kelompokkan flat list riwayat -> per hari -> per proyek (asumsi input
// sudah terurut tanggal desc lalu created_at desc, jadi cukup grouping
// berdasarkan baris bersebelahan, sama seperti groupAbsensiTimPerHari).
function kelompokkan(riwayat) {
  const perHari = [];
  for (const r of riwayat) {
    const lastHari = perHari[perHari.length - 1];
    const hari = lastHari && lastHari.tanggal === r.tanggal ? lastHari : (perHari.push({ tanggal: r.tanggal, proyekGrup: [] }), perHari[perHari.length - 1]);
    const nama = r.proyek?.nama || "—";
    const lastProyek = hari.proyekGrup[hari.proyekGrup.length - 1];
    if (lastProyek && lastProyek.nama === nama) lastProyek.items.push(r);
    else hari.proyekGrup.push({ nama, items: [r] });
  }
  return perHari;
}

// Riwayat Laporan Harian — dikelompokkan hari > dropdown proyek > baris
// ringkas, ketuk baris untuk lihat detail (foto + deskripsi penuh).
export default function RiwayatLaporanHarianCard({ riwayat = [] }) {
  const perHari = kelompokkan(riwayat);
  const [openHari, setOpenHari] = useState(perHari[0]?.tanggal ?? null);
  const [openProyek, setOpenProyek] = useState(null); // `${tanggal}|${nama}`
  const [detail, setDetail] = useState(null);

  if (!riwayat.length) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-3 font-bold text-gray-700">Riwayat Laporan Harian</h2>
      <div className="space-y-2">
        {perHari.map((h) => {
          const totalHari = h.proyekGrup.reduce((s, p) => s + p.items.length, 0);
          const hariTerbuka = openHari === h.tanggal;
          return (
            <div key={h.tanggal} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenHari((cur) => (cur === h.tanggal ? null : h.tanggal))}
                className="flex w-full items-center justify-between px-4 py-2.5"
              >
                <span className="text-sm font-semibold capitalize text-gray-700">{labelTanggal(h.tanggal)}</span>
                <span className="flex items-center gap-2 text-gray-400">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                    {totalHari} laporan
                  </span>
                  <Icon name="chevron-down" className={`h-3.5 w-3.5 transition-transform ${hariTerbuka ? "rotate-180" : ""}`} />
                </span>
              </button>

              {hariTerbuka && (
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {h.proyekGrup.map((p) => {
                    const key = `${h.tanggal}|${p.nama}`;
                    const proyekTerbuka = openProyek === key;
                    return (
                      <div key={key}>
                        <button
                          type="button"
                          onClick={() => setOpenProyek((cur) => (cur === key ? null : key))}
                          className="flex w-full items-center justify-between px-4 py-2 active:bg-gray-50"
                        >
                          <span className="text-sm font-semibold text-gray-600">{p.nama}</span>
                          <span className="flex items-center gap-2 text-gray-400">
                            <span className="text-[11px]">{p.items.length} kegiatan</span>
                            <Icon name="chevron-down" className={`h-3 w-3 transition-transform ${proyekTerbuka ? "rotate-180" : ""}`} />
                          </span>
                        </button>

                        {proyekTerbuka && (
                          <div className="space-y-1 bg-gray-50/60 px-4 pb-2">
                            {p.items.map((it) => {
                              const badge = STATUS_BADGE[it.status] || STATUS_BADGE.ON_PROGRESS;
                              return (
                                <button
                                  key={it.id}
                                  type="button"
                                  onClick={() => setDetail(it)}
                                  className="flex w-full items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-left active:bg-gray-100"
                                >
                                  {it.fotoSignedUrl ? (
                                    <img src={it.fotoSignedUrl} alt="" className="h-9 w-9 shrink-0 rounded-md border border-gray-200 object-cover" />
                                  ) : (
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-300">
                                      <Icon name="camera" className="h-4 w-4" />
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium text-gray-700">{it.deskripsi}</span>
                                    <span className="text-[10px] text-gray-400">{jamnya(it.created_at)}</span>
                                  </span>
                                  <span className={`badge shrink-0 !text-[10px] ${badge.cls}`}>{badge.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white p-4 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-800">{detail.proyek?.nama || "—"}</p>
                <p className="text-xs text-gray-400">
                  {labelTanggal(detail.tanggal)} · {jamnya(detail.created_at)}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="shrink-0 px-1 text-2xl leading-none text-gray-400">×</button>
            </div>
            <span className={`badge mb-3 w-fit ${(STATUS_BADGE[detail.status] || STATUS_BADGE.ON_PROGRESS).cls}`}>
              {(STATUS_BADGE[detail.status] || STATUS_BADGE.ON_PROGRESS).label}
            </span>
            {detail.fotoSignedUrl && (
              <img
                src={detail.fotoSignedUrl}
                alt="dokumentasi"
                className="mb-3 max-h-[45vh] w-full rounded-xl border border-gray-200 object-contain"
              />
            )}
            <p className="overflow-y-auto text-sm text-gray-700">{detail.deskripsi}</p>
          </div>
        </div>
      )}
    </section>
  );
}
