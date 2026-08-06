"use client";
import { useState } from "react";
import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";
import MediaGallery from "@/components/MediaGallery";

const STATUS_LABEL = {
  OPEN: { label: "Belum Dikerjakan", cls: "text-gray-400" },
  IN_PROGRESS: { label: "Diproses", cls: "text-amber-500" },
  PENDING_REVIEW: { label: "Menunggu Persetujuan Supervisor", cls: "text-amber-500" },
  DONE: { label: "Selesai", cls: "text-green-500" },
  CANCELLED: { label: "Tidak Disetujui", cls: "text-red-500" },
};

const FILTER_TABS = [
  { key: "SEMUA", label: "Semua" },
  { key: "PENDING_REVIEW", label: "Menunggu Persetujuan" },
];

// Kelompokkan list flat -> per proyek, urutan mengikuti kemunculan pertama
// di `list` (list sudah terurut created_at dari query server).
function kelompokkanProyek(list) {
  const grup = [];
  const idx = new Map();
  for (const it of list) {
    if (!idx.has(it.proyek_id)) {
      idx.set(it.proyek_id, grup.length);
      grup.push({ proyekId: it.proyek_id, nama: it.proyek, items: [] });
    }
    grup[idx.get(it.proyek_id)].items.push(it);
  }
  return grup;
}

// Read-only — Master hanya memantau, persetujuan tetap di Supervisor
// (lihat app/supervisor/perbaikan/PerbaikanForm.jsx). Tampilan disamakan
// dengan daftar Supervisor: search + tab status + card per proyek yang
// bisa dibuka/tutup, supaya makin banyak proyek tetap ringkas dipantau.
export default function PerbaikanList({ items = [] }) {
  const [cari, setCari] = useState("");
  const [filterStatus, setFilterStatus] = useState("SEMUA");
  // Proyek yang punya item PENDING_REVIEW terbuka duluan — itu yang paling
  // relevan dipantau Master; sisanya tertutup biar ringkas.
  const [openProyek, setOpenProyek] = useState(
    () =>
      new Set(
        kelompokkanProyek(items)
          .filter((g) => g.items.some((it) => it.status === "PENDING_REVIEW"))
          .map((g) => g.proyekId)
      )
  );
  const toggleProyek = (id) =>
    setOpenProyek((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (items.length === 0)
    return (
      <div className="card flex flex-col items-center gap-2 border-green-200 bg-green-50 p-8 text-center text-green-700">
        <Icon name="check-circle" className="h-9 w-9" />
        <p className="font-semibold">Belum ada item perbaikan.</p>
      </div>
    );

  const totalMenunggu = items.filter((it) => it.status === "PENDING_REVIEW").length;

  // Pencarian & filter status jalan lintas-proyek — saat aktif, grup yang
  // cocok otomatis kebuka (lihat `terbuka` di render) dan yang gak cocok
  // disembunyikan.
  const sedangFilter = cari.trim() !== "" || filterStatus !== "SEMUA";
  const norm = (s) => (s || "").toLowerCase();
  const grupTampil = kelompokkanProyek(items)
    .map((g) => {
      const needle = norm(cari);
      const itemsTampil = g.items.filter((it) => {
        if (filterStatus !== "SEMUA" && it.status !== filterStatus) return false;
        if (!needle) return true;
        return norm(it.uraian).includes(needle) || norm(g.nama).includes(needle);
      });
      return { ...g, itemsTampil };
    })
    .filter((g) => !sedangFilter || g.itemsTampil.length > 0)
    // Proyek dengan item menunggu persetujuan naik ke atas.
    .sort((a, b) => {
      const pendingA = a.items.filter((it) => it.status === "PENDING_REVIEW").length;
      const pendingB = b.items.filter((it) => it.status === "PENDING_REVIEW").length;
      return pendingB - pendingA;
    });

  return (
    <>
      <div className="relative mb-3">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari uraian atau proyek..."
          className="input !py-2.5 !pl-10 !text-sm"
        />
      </div>

      <div className="mb-3 flex gap-1 border-b border-gray-200">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilterStatus(t.key)}
            className={`relative px-3 py-2 text-sm font-semibold transition-colors ${
              filterStatus === t.key ? "text-brand" : "text-gray-400"
            }`}
          >
            {t.label}
            {t.key === "PENDING_REVIEW" && totalMenunggu > 0 && (
              <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] text-white">{totalMenunggu}</span>
            )}
            {filterStatus === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand" />
            )}
          </button>
        ))}
      </div>

      {grupTampil.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
          <Icon name="search" className="h-8 w-8" />
          <p className="font-semibold">Tidak ada yang cocok.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {grupTampil.map((g) => {
            const belum = g.items.filter((it) => it.status === "OPEN" || it.status === "IN_PROGRESS").length;
            const menunggu = g.items.filter((it) => it.status === "PENDING_REVIEW").length;
            const selesai = g.items.filter((it) => it.status === "DONE").length;
            const terbuka = sedangFilter || openProyek.has(g.proyekId);
            return (
              <div key={g.proyekId} className="card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleProyek(g.proyekId)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 active:bg-gray-50"
                >
                  <span className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                      <span className="truncate text-sm font-bold text-gray-700">{g.nama}</span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                      {menunggu > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          {menunggu} menunggu
                        </span>
                      )}
                      {belum > 0 && (
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                          {belum} belum
                        </span>
                      )}
                      {selesai > 0 && (
                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                          {selesai} selesai
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-gray-400">
                    <span className="text-[11px]">{g.items.length}</span>
                    <Icon name="chevron-down" className={`h-3.5 w-3.5 transition-transform ${terbuka ? "rotate-180" : ""}`} />
                  </span>
                </button>

                {terbuka && (
                  <div className="space-y-1.5 border-t border-gray-100 bg-gray-50/60 p-1.5">
                    {g.itemsTampil.map((it) => {
                      const st = STATUS_LABEL[it.status] || STATUS_LABEL.OPEN;
                      return (
                        <div key={it.id} className="rounded-lg bg-white p-2 shadow-sm">
                          <div className="flex items-start gap-2">
                            <MediaGallery
                              media={[
                                ...(it.mediaTemuan || []).map((m) => ({ ...m, caption: it.uraian })),
                                ...(it.mediaBukti || []).map((m) => ({ ...m, caption: `Bukti — ${it.uraian}` })),
                              ]}
                              size="h-9 w-9"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold leading-snug">{it.uraian}</p>
                              <p className="mt-0.5 truncate text-[10px] text-gray-400">
                                <span className={`font-semibold ${st.cls}`}>{st.label}</span>
                                {" "}· {tglID(it.created_at)}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-gray-400">Dibuat oleh {it.pembuat}</p>
                            </div>
                          </div>

                          {it.catatan_tolak && (
                            <div className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5">
                              <p className="text-[10px] font-bold text-red-700">Ditolak Supervisor</p>
                              <p className="text-xs text-red-600">{it.catatan_tolak}</p>
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
      )}
    </>
  );
}
