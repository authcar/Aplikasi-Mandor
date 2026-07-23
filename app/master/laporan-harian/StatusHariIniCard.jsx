"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

const STATUS_BADGE = {
  ON_PROGRESS: { label: "Sedang Dikerjakan", cls: "bg-blue-100 text-blue-700" },
  DONE: { label: "Selesai", cls: "bg-green-100 text-green-700" },
  PERBAIKAN: { label: "Perlu Perbaikan", cls: "bg-red-100 text-red-700" },
};

const FILTERS = [
  { key: "belum", label: "Belum" },
  { key: "semua", label: "Semua" },
  { key: "sudah", label: "Sudah" },
];

const jamnya = (ts) =>
  new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

// Status laporan harian hari ini per proyek — grid 2 kolom biar padat (banyak
// proyek gak perlu scroll panjang), default nyaring ke yang "Belum" karena
// itu yang paling perlu ditindaklanjuti Master. Ketuk kartu hijau untuk lihat
// detail laporan (modal), kartu merah cuma penanda belum ada laporan.
export default function StatusHariIniCard({ proyekList = [] }) {
  const belum = proyekList.filter((p) => p.items.length === 0);
  const sudah = proyekList.filter((p) => p.items.length > 0);

  const [filter, setFilter] = useState(belum.length > 0 ? "belum" : "semua");
  const [detail, setDetail] = useState(null);

  if (!proyekList.length) return null;

  const shown = filter === "belum" ? belum : filter === "sudah" ? sudah : proyekList;
  const persen = proyekList.length ? Math.round((sudah.length / proyekList.length) * 100) : 0;

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-bold text-gray-700">Status Hari Ini</h2>
        <span className="text-xs font-semibold text-gray-400">
          {sudah.length}/{proyekList.length} sudah lapor
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${persen}%` }} />
      </div>

      <div className="mb-3 flex gap-1 rounded-xl bg-gray-100 p-1">
        {FILTERS.map((f) => {
          const count = f.key === "belum" ? belum.length : f.key === "sudah" ? sudah.length : proyekList.length;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                filter === f.key ? "bg-white text-brand shadow-sm" : "text-gray-500"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="card flex flex-col items-center gap-1.5 border-green-200 bg-green-50 p-5 text-center text-green-700">
          <Icon name="check-circle" className="h-6 w-6" />
          <p className="text-sm font-semibold">
            {filter === "belum" ? "Semua proyek sudah lapor hari ini." : "Belum ada laporan di kategori ini."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {shown.map((p) => {
            const ada = p.items.length > 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => ada && setDetail(p)}
                className={`card flex flex-col gap-1 p-3 text-left ${ada ? "active:bg-gray-50" : ""}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <Icon
                    name={ada ? "check-circle" : "x-circle"}
                    className={`h-4 w-4 shrink-0 ${ada ? "text-green-500" : "text-red-500"}`}
                  />
                  {ada && p.items.length > 1 && (
                    <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                      {p.items.length}x
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 text-xs font-semibold leading-tight text-gray-700">{p.nama}</p>
                <p className="truncate text-[10px] text-gray-400">{p.supervisorNama || "—"}</p>
              </button>
            );
          })}
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white p-4 shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="font-semibold text-gray-800">{detail.nama}</p>
              <button onClick={() => setDetail(null)} className="shrink-0 px-1 text-2xl leading-none text-gray-400">
                ×
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto">
              {detail.items.map((it) => {
                const badge = STATUS_BADGE[it.status] || STATUS_BADGE.ON_PROGRESS;
                return (
                  <div key={it.id} className="rounded-xl border border-gray-100 p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className={`badge ${badge.cls}`}>{badge.label}</span>
                      <span className="text-xs text-gray-400">{jamnya(it.created_at)}</span>
                    </div>
                    {it.fotoSignedUrl && (
                      <img
                        src={it.fotoSignedUrl}
                        alt="dokumentasi"
                        className="mb-2 max-h-52 w-full rounded-lg border border-gray-200 object-cover"
                      />
                    )}
                    <p className="text-sm text-gray-700">{it.deskripsi}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
