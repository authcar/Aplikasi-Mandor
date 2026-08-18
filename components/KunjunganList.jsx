"use client";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { durasiTeks, jamWIB } from "@/lib/format";

// Riwayat kunjungan Supervisor — dipakai bareng oleh /supervisor/kunjungan
// (riwayat sendiri) dan /master/kunjungan (semua supervisor). Bedanya cuma
// kolom nama supervisor, makanya jadi prop, pola sama dengan NilaiJasaList.
//
// Ringkasan di atas dihitung dari baris yang SEDANG tersaring, bukan dari
// seluruh data — supaya "total durasi" ikut berubah saat difilter per proyek
// atau per bulan, bukan angka yang tidak nyambung dengan daftar di bawahnya.

const STATUS = {
  BERJALAN: { label: "Berjalan", cls: "bg-amber-100 text-amber-700" },
  SELESAI: { label: "Selesai", cls: "bg-green-100 text-green-700" },
  TIDAK_SAH: { label: "Tidak Sah", cls: "bg-red-100 text-red-700" },
};

const labelTanggal = (iso) =>
  new Date(iso).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

export default function KunjunganList({ rows = [], tampilkanSupervisor = false }) {
  const [cari, setCari] = useState("");
  const [proyekFilter, setProyekFilter] = useState("");
  const [bulanFilter, setBulanFilter] = useState("");

  const daftarProyek = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => r.proyek_id && map.set(r.proyek_id, r.proyek));
    return [...map].map(([id, nama]) => ({ id, nama })).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [rows]);

  const daftarBulan = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => map.set(r.bulan, r.bulanLabel));
    return [...map].map(([nilai, label]) => ({ nilai, label })).sort((a, b) => b.nilai.localeCompare(a.nilai));
  }, [rows]);

  const norm = (s) => (s || "").toLowerCase();
  const tersaring = useMemo(() => {
    const needle = norm(cari);
    return rows.filter((r) => {
      if (proyekFilter && r.proyek_id !== proyekFilter) return false;
      if (bulanFilter && r.bulan !== bulanFilter) return false;
      if (!needle) return true;
      return norm(r.proyek).includes(needle) || norm(r.supervisor).includes(needle);
    });
  }, [rows, cari, proyekFilter, bulanFilter]);

  const ringkas = useMemo(() => {
    const totalMenit = tersaring.reduce((s, r) => s + (r.menit || 0), 0);
    return {
      jumlah: tersaring.length,
      durasi: durasiTeks(totalMenit),
      tidakSah: tersaring.filter((r) => r.status === "TIDAK_SAH").length,
    };
  }, [tersaring]);

  return (
    <>
      <div className="hero mb-4 grid grid-cols-3 divide-x divide-white/20 rounded-2xl px-2 py-3">
        <Ringkas nilai={ringkas.jumlah} label="Kunjungan" />
        <Ringkas nilai={ringkas.durasi} label="Total durasi" />
        <Ringkas nilai={ringkas.tidakSah} label="Tidak sah" />
      </div>

      <div className="card mb-3 p-3">
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={tampilkanSupervisor ? "Cari proyek atau supervisor..." : "Cari proyek..."}
            className="input !py-2 !pl-9 !text-sm"
          />
        </div>
        {(daftarProyek.length > 1 || daftarBulan.length > 1) && (
          <div className="mt-2 flex gap-2">
            {daftarProyek.length > 1 && (
              <select
                value={proyekFilter}
                onChange={(e) => setProyekFilter(e.target.value)}
                className="input !w-auto flex-1 !py-1.5 !pl-3 !pr-8 text-xs font-semibold"
              >
                <option value="">Semua Proyek</option>
                {daftarProyek.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            )}
            {daftarBulan.length > 1 && (
              <select
                value={bulanFilter}
                onChange={(e) => setBulanFilter(e.target.value)}
                className="input !w-auto flex-1 !py-1.5 !pl-3 !pr-8 text-xs font-semibold"
              >
                <option value="">Semua Bulan</option>
                {daftarBulan.map((b) => (
                  <option key={b.nilai} value={b.nilai}>
                    {b.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {tersaring.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-8 text-center text-gray-400">
          <Icon name="map-pin" className="h-8 w-8" />
          <p className="text-sm font-medium">
            {rows.length === 0 ? "Belum ada kunjungan tercatat." : "Tidak ada kunjungan yang cocok."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tersaring.map((r) => {
            const st = STATUS[r.status] || STATUS.SELESAI;
            return (
              <div key={r.id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">{r.proyek}</p>
                    {tampilkanSupervisor && (
                      <p className="truncate text-xs text-gray-500">{r.supervisor}</p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-400">{labelTanggal(r.mulai_at)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-3 border-t border-gray-100 pt-2 text-xs text-gray-600">
                  <span className="tabular-nums">
                    {jamWIB(r.mulai_at)} – {r.selesai_at ? jamWIB(r.selesai_at) : "…"}
                  </span>
                  <span className="font-semibold tabular-nums text-brand">
                    {r.menit == null ? "berjalan" : durasiTeks(r.menit)}
                  </span>
                  {r.akurasi_masuk != null && (
                    <span className="ml-auto text-[11px] text-gray-400">±{Math.round(r.akurasi_masuk)}m</span>
                  )}
                </div>

                {r.catatan_sistem && (
                  <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-700">
                    {r.catatan_sistem}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Ringkas({ nilai, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <p className="text-lg font-bold leading-tight tabular-nums">{nilai}</p>
      <p className="text-[10px] text-white/70">{label}</p>
    </div>
  );
}
