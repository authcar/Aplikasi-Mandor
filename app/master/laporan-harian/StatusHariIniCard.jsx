"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

const STATUS_BADGE = {
  ON_PROGRESS: { label: "Sedang Dikerjakan", cls: "bg-blue-100 text-blue-700" },
  DONE: { label: "Selesai", cls: "bg-green-100 text-green-700" },
  PERBAIKAN: { label: "Perlu Perbaikan", cls: "bg-red-100 text-red-700" },
};

const jamnya = (ts) =>
  new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

// Status laporan harian hari ini per proyek — hijau+dropdown kalau sudah ada
// laporan, merah kalau belum, biar Master gak perlu buka riwayat satu-satu.
export default function StatusHariIniCard({ proyekList = [] }) {
  const [open, setOpen] = useState(null); // proyek id yang dropdown-nya terbuka
  const [detail, setDetail] = useState(null);

  if (!proyekList.length) return null;

  const sudahCount = proyekList.filter((p) => p.items.length > 0).length;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-gray-700">Status Hari Ini</h2>
        <span className="text-xs font-semibold text-gray-400">
          {sudahCount}/{proyekList.length} sudah lapor
        </span>
      </div>
      <div className="card divide-y divide-gray-100 overflow-hidden">
        {proyekList.map((p) => {
          const sudah = p.items.length > 0;
          const terbuka = open === p.id;
          return (
            <div key={p.id}>
              <button
                type="button"
                onClick={() => sudah && setOpen((cur) => (cur === p.id ? null : p.id))}
                className={`flex w-full items-center gap-3 px-4 py-3 ${sudah ? "active:bg-gray-50" : ""}`}
              >
                <Icon
                  name={sudah ? "check-circle" : "x-circle"}
                  className={`h-5 w-5 shrink-0 ${sudah ? "text-green-500" : "text-red-500"}`}
                />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-gray-700">{p.nama}</p>
                  <p className="truncate text-xs text-gray-400">{p.supervisorNama || "—"}</p>
                </div>
                {sudah ? (
                  <Icon
                    name="chevron-down"
                    className={`h-3.5 w-3.5 shrink-0 text-gray-300 transition-transform ${terbuka ? "rotate-180" : ""}`}
                  />
                ) : (
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                    Belum
                  </span>
                )}
              </button>

              {sudah && terbuka && (
                <div className="space-y-1 bg-gray-50/60 px-4 pb-2.5">
                  {p.items.map((it) => {
                    const badge = STATUS_BADGE[it.status] || STATUS_BADGE.ON_PROGRESS;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => setDetail({ ...it, proyekNama: p.nama })}
                        className="flex w-full items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-left active:bg-gray-100"
                      >
                        {it.fotoSignedUrl ? (
                          <img
                            src={it.fotoSignedUrl}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-md border border-gray-200 object-cover"
                          />
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
                <p className="font-semibold text-gray-800">{detail.proyekNama}</p>
                <p className="text-xs text-gray-400">{jamnya(detail.created_at)}</p>
              </div>
              <button onClick={() => setDetail(null)} className="shrink-0 px-1 text-2xl leading-none text-gray-400">
                ×
              </button>
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
