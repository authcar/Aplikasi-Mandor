"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { KLASIFIKASI_MANPOWER, KOLOM_MANPOWER, jumlahManpower, susunManpower } from "@/lib/manpower";

const dariServer = (rows) =>
  Object.fromEntries(
    susunManpower(rows).map((r) => [
      r.nama,
      Object.fromEntries(KOLOM_MANPOWER.map((k) => [k.key, r[k.key] ? String(r[k.key]) : ""])),
    ])
  );

const JEDA_SIMPAN = 700; // ms setelah ketikan terakhir

// Input Man Power hari ini untuk proyek yang dipilih (tabel MAN POWER di PDF).
// Tersimpan otomatis beberapa saat setelah berhenti mengetik; terpisah dari
// kegiatan, jadi bisa diisi/diubah kapan pun hari itu.
export default function ManpowerCard({ proyekId }) {
  const [buka, setBuka] = useState(false);
  const [nilai, setNilai] = useState(() => dariServer([]));
  const [memuat, setMemuat] = useState(false);
  const [status, setStatus] = useState(null); // { tipe: "simpan" | "ok" | "galat", teks }
  const timer = useRef(null);
  const tertunda = useRef(null); // { proyek, data } yang belum terkirim
  const rantai = useRef(Promise.resolve()); // PUT dikirim berurutan, tidak saling menyalip

  const kirim = ({ proyek, data }) => {
    setStatus({ tipe: "simpan", teks: "Menyimpan…" });
    rantai.current = rantai.current.then(async () => {
      try {
        const res = await fetch("/api/laporan-harian/manpower", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proyek_id: proyek,
            rows: KLASIFIKASI_MANPOWER.map((nama) => ({ klasifikasi: nama, ...data[nama] })),
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || "Gagal menyimpan.");
        if (!tertunda.current) setStatus({ tipe: "ok", teks: "Tersimpan ✓" });
      } catch (e) {
        setStatus({ tipe: "galat", teks: `${e.message} Ketik ulang untuk mencoba lagi.` });
      }
    });
  };

  // Kirim sekarang juga apa pun yang masih menunggu jeda (ganti proyek / tutup halaman).
  const bilas = () => {
    clearTimeout(timer.current);
    timer.current = null;
    const p = tertunda.current;
    tertunda.current = null;
    if (p) kirim(p);
  };

  useEffect(() => {
    if (!proyekId) return;
    let batal = false;
    setMemuat(true);
    setStatus(null);
    fetch(`/api/laporan-harian/manpower?proyek_id=${proyekId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!batal) setNilai(dariServer(j.rows || []));
      })
      .catch(() => {})
      .finally(() => !batal && setMemuat(false));
    return () => {
      batal = true;
      bilas();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyekId]);

  const ubah = (nama, key, v) => {
    const baru = { ...nilai, [nama]: { ...nilai[nama], [key]: v.replace(/\D/g, "").slice(0, 3) } };
    setNilai(baru);
    tertunda.current = { proyek: proyekId, data: baru };
    setStatus({ tipe: "simpan", teks: "Menyimpan…" });
    clearTimeout(timer.current);
    timer.current = setTimeout(bilas, JEDA_SIMPAN);
  };

  const totalHadir = KLASIFIKASI_MANPOWER.reduce((s, nama) => s + jumlahManpower(nilai[nama]), 0);

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
            Site = hadir di lokasi, Ws = hadir di workshop. Jumlah di PDF = Site + Ws + Lembur. Tersimpan otomatis.
          </p>
          {status && (
            <p
              className={`text-xs font-medium ${
                status.tipe === "galat" ? "text-red-600" : status.tipe === "ok" ? "text-emerald-600" : "text-gray-400"
              }`}
            >
              {status.teks}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
