"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { labelDeadlineProyek } from "@/lib/format";
import Icon from "@/components/Icon";

// Card "Proyek Saya" (dashboard Supervisor/Master) — daftar semua proyek
// aktif dengan badge deadline, plus tombol "Cari" (gaya sama dengan
// ProyekSwitcher milik Mandor) buat nyaring lewat nama/lokasi/mandor kalau
// daftarnya panjang.
export default function ProyekSayaCard({ proyek = [], basePath, title = "Proyek Saya" }) {
  const [cariOpen, setCariOpen] = useState(false);
  const [q, setQ] = useState("");

  const norm = (s) => (s || "").toLowerCase();
  const filtered = useMemo(() => {
    const needle = norm(q);
    if (!needle) return proyek;
    return proyek.filter(
      (p) =>
        norm(p.nama).includes(needle) ||
        norm(p.lokasi).includes(needle) ||
        norm(p.mandor?.name).includes(needle)
    );
  }, [proyek, q]);

  const bukaCari = () => {
    setCariOpen(true);
    setQ("");
  };
  const tutupCari = () => {
    setCariOpen(false);
    setQ("");
  };

  return (
    <div className="card flex flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <h2 className="text-sm font-bold text-gray-700">
          {title} ({proyek.length})
        </h2>
        {proyek.length > 1 && (
          <button
            type="button"
            onClick={() => (cariOpen ? tutupCari() : bukaCari())}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold active:bg-brand-50 ${
              cariOpen ? "bg-brand-50 text-brand" : "text-brand"
            }`}
          >
            <Icon name="search" className="h-3.5 w-3.5" />
            Cari
          </button>
        )}
      </div>

      {cariOpen && (
        <div className="relative border-b border-gray-100 px-3 py-2">
          <Icon name="search" className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && tutupCari()}
            placeholder="Cari proyek, lokasi, atau mandor..."
            className="input !py-2 !pl-9 !text-sm"
          />
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {filtered.map((p) => {
          const deadline = labelDeadlineProyek(p.deadline);
          return (
            <Link
              key={p.id}
              href={`${basePath}/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
            >
              <span className="icon-tile bg-brand-50 text-brand-600 !h-8 !w-8">
                <Icon name={p.icon || "building"} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{p.nama}</p>
                  {p.mandor?.name && (
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                      {p.mandor.name}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500">{p.lokasi}</p>
                {deadline && (
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${deadline.cls}`}
                  >
                    <Icon name="calendar" className="h-3 w-3" />
                    {deadline.teks}
                  </span>
                )}
              </div>
              <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-gray-300" />
            </Link>
          );
        })}
        {proyek.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">Belum ada proyek dari Taraco.</div>
        )}
        {proyek.length > 0 && filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">Tidak ada proyek yang cocok.</div>
        )}
      </div>
    </div>
  );
}
