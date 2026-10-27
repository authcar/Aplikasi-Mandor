"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { KLASIFIKASI_MANPOWER, KOLOM_MANPOWER, jumlahManpower, susunManpower } from "@/lib/manpower";

const dariServer = (rows) =>
  Object.fromEntries(
    susunManpower(rows).map((r) => [
      r.nama,
      Object.fromEntries(KOLOM_MANPOWER.map((k) => [k.key, r[k.key] ? String(r[k.key]) : ""])),
    ])
  );

// Input Man Power hari ini untuk proyek yang dipilih (tabel MAN POWER di PDF).
// Disimpan terpisah dari kegiatan, jadi bisa diisi/diubah kapan pun hari itu.
export default function ManpowerCard({ proyekId }) {
  const [buka, setBuka] = useState(false);
  const [nilai, setNilai] = useState(() => dariServer([]));
  const [memuat, setMemuat] = useState(false);
  const [simpan, setSimpan] = useState(false);
  const [pesan, setPesan] = useState(null); // { ok, teks }

  useEffect(() => {
    if (!proyekId) return;
    let batal = false;
    setMemuat(true);
    setPesan(null);
    fetch(`/api/laporan-harian/manpower?proyek_id=${proyekId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!batal) setNilai(dariServer(j.rows || []));
      })
      .catch(() => {})
      .finally(() => !batal && setMemuat(false));
    return () => {
      batal = true;
    };
  }, [proyekId]);

  const ubah = (nama, key, v) => {
    setPesan(null);
    setNilai((n) => ({ ...n, [nama]: { ...n[nama], [key]: v.replace(/\D/g, "").slice(0, 3) } }));
  };

  const totalHadir = KLASIFIKASI_MANPOWER.reduce((s, nama) => s + jumlahManpower(nilai[nama]), 0);

  const simpanSemua = async () => {
    setSimpan(true);
    setPesan(null);
    try {
      const res = await fetch("/api/laporan-harian/manpower", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyek_id: proyekId,
          rows: KLASIFIKASI_MANPOWER.map((nama) => ({ klasifikasi: nama, ...nilai[nama] })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan.");
      setPesan({ ok: true, teks: "Man Power tersimpan ✓" });
    } catch (e) {
      setPesan({ ok: false, teks: e.message });
    } finally {
      setSimpan(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-bold text-gray-700">Man Power Hari Ini</span>
        <span className="flex items-center gap-2 text-gray-400">
          {totalHadir > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              {totalHadir} orang
            </span>
          )}
          <Icon name="chevron-down" className={`h-4 w-4 transition-transform ${buka ? "rotate-180" : ""}`} />
        </span>
      </button>

      {buka && (
        <div className="space-y-3 border-t border-gray-100 px-4 py-3">
          <div className="grid grid-cols-[1fr_repeat(4,2.75rem)] items-center gap-x-1.5 gap-y-1.5">
            <span />
            {KOLOM_MANPOWER.map((k) => (
              <span key={k.key} className="text-center text-[10px] font-semibold uppercase text-gray-400">
                {k.label}
              </span>
            ))}
            {KLASIFIKASI_MANPOWER.map((nama) => (
              <div key={nama} className="contents">
                <span className="truncate text-xs font-medium text-gray-600">{nama}</span>
                {KOLOM_MANPOWER.map((k) => (
                  <input
                    key={k.key}
                    type="text"
                    inputMode="numeric"
                    value={nilai[nama]?.[k.key] ?? ""}
                    onChange={(e) => ubah(nama, k.key, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    placeholder="0"
                    aria-label={`${nama} ${k.label}`}
                    disabled={memuat}
                    className="h-9 w-full rounded-lg border border-gray-200 bg-white text-center text-sm focus:border-brand focus:outline-none disabled:bg-gray-50"
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400">
            Site = hadir di lokasi, Ws = hadir di workshop. Jumlah di PDF = Site + Ws + Lembur.
          </p>
          <button
            type="button"
            onClick={simpanSemua}
            disabled={simpan || memuat}
            className="w-full rounded-xl bg-brand/10 py-2.5 text-sm font-semibold text-brand active:opacity-70 disabled:opacity-50"
          >
            {simpan ? "Menyimpan…" : "Simpan Man Power"}
          </button>
          {pesan && (
            <p className={`text-xs font-medium ${pesan.ok ? "text-emerald-600" : "text-red-600"}`}>{pesan.teks}</p>
          )}
        </div>
      )}
    </div>
  );
}
