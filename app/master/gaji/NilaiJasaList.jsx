"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { rupiah } from "@/lib/format";
import Icon from "@/components/Icon";

// Search + dropdown filter proyek — daftar tetap nampilin semua baris
// (biar nilai jasa antar-proyek masih bisa dibandingkan sekilas), cuma
// jadi bisa disaring lewat ketik nama/lokasi/mandor atau pilih 1 proyek.
export default function NilaiJasaList({ proyek = [] }) {
  const [cari, setCari] = useState("");
  const [proyekFilter, setProyekFilter] = useState("");

  const norm = (s) => (s || "").toLowerCase();
  const filtered = useMemo(() => {
    const needle = norm(cari);
    return proyek.filter((p) => {
      if (proyekFilter && p.id !== proyekFilter) return false;
      if (!needle) return true;
      return (
        norm(p.nama).includes(needle) ||
        norm(p.lokasi).includes(needle) ||
        norm(p.mandor?.name).includes(needle)
      );
    });
  }, [proyek, cari, proyekFilter]);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-gray-100 px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-700">Nilai Jasa per Proyek</h2>
          {proyek.length > 1 && (
            <select
              value={proyekFilter}
              onChange={(e) => setProyekFilter(e.target.value)}
              className="input w-auto !py-1.5 !pl-3 !pr-8 text-xs font-semibold"
            >
              <option value="">Semua Proyek</option>
              {proyek.map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          )}
        </div>
        <div className="relative mt-2.5">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari proyek, lokasi, atau mandor..."
            className="input !py-2 !pl-9 !text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="p-6 text-center text-sm text-gray-400">
          {proyek.length === 0 ? "Belum ada proyek aktif." : "Tidak ada proyek yang cocok."}
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/master/proyek/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
            >
              <span className="icon-tile !h-9 !w-9 shrink-0 bg-brand-50 text-brand-600">
                <Icon name={p.icon || "building"} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.nama}</p>
                <p className="truncate text-xs text-gray-500">
                  {p.lokasi || "—"} · {p.mandor?.name || "Belum ada mandor"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {p.nilai_proyek ? (
                  <p className="text-sm font-bold text-emerald-600">{rupiah(p.nilai_proyek)}</p>
                ) : (
                  <p className="text-sm text-gray-300">—</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
