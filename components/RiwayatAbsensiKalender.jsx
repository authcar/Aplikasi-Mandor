"use client";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { laporanTeks, totalOrangTim, tglLaporanID } from "@/lib/format";

const HARI_LABEL = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN_LABEL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const pad2 = (n) => String(n).padStart(2, "0");
const toIso = (year, month, day) => `${year}-${pad2(month + 1)}-${pad2(day)}`;

function buildGrid(year, month) {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Kalender riwayat absensi (Master) — pengganti list datar: indikator titik
// di tanggal yang ada laporannya, tap tanggal buat lihat detail di bawah.
// `riwayat`: [{ tanggal: "2026-07-08", tims: [{ nama, lines: [{jumlah, kegiatan}] }] }]
export default function RiwayatAbsensiKalender({ riwayat = [], defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [salinAt, setSalinAt] = useState(null);

  const riwayatMap = useMemo(() => new Map(riwayat.map((h) => [h.tanggal, h])), [riwayat]);

  const awal = riwayat.length > 0 ? new Date(`${riwayat[0].tanggal}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(awal.getFullYear());
  const [viewMonth, setViewMonth] = useState(awal.getMonth());
  const [selected, setSelected] = useState(riwayat[0]?.tanggal || null);

  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const grid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const hariIni = selected ? riwayatMap.get(selected) : null;

  const gantiBulan = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const pilihTanggal = (iso) => {
    if (!riwayatMap.has(iso)) return;
    setSelected((cur) => (cur === iso ? null : iso));
  };

  const salin = async () => {
    if (!hariIni) return;
    await navigator.clipboard.writeText(laporanTeks(hariIni.tanggal, hariIni.tims));
    setSalinAt(hariIni.tanggal);
    setTimeout(() => setSalinAt((cur) => (cur === hariIni.tanggal ? null : cur)), 2000);
  };

  return (
    <div className="card mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-bold text-gray-700">Riwayat Absensi</span>
        <span className="flex items-center gap-2 text-gray-400">
          {riwayat.length > 0 && (
            <span className="text-xs font-medium">{riwayat.length} hari</span>
          )}
          <Icon name="chevron-down" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-3">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => gantiBulan(-1)} className="p-1.5 text-gray-400 active:text-gray-600">
              <Icon name="chevron-left" className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-gray-700">
              {BULAN_LABEL[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={() => gantiBulan(1)} className="p-1.5 text-gray-400 active:text-gray-600">
              <Icon name="chevron-right" className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {HARI_LABEL.map((h) => (
              <span key={h} className="text-[10px] font-semibold text-gray-400">{h}</span>
            ))}
            {grid.map((day, i) => {
              if (!day) return <span key={i} />;
              const iso = toIso(viewYear, viewMonth, day);
              const ada = riwayatMap.has(iso);
              const isSelected = selected === iso;
              const isFuture = iso > todayIso;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!ada}
                  onClick={() => pilihTanggal(iso)}
                  className={`mx-auto flex h-9 w-9 flex-col items-center justify-center gap-0.5 rounded-full text-xs font-semibold transition-colors ${
                    isSelected
                      ? "bg-brand text-white"
                      : ada
                        ? "text-gray-700 active:bg-gray-100"
                        : isFuture
                          ? "text-gray-200"
                          : "text-gray-400"
                  }`}
                >
                  {day}
                  <span
                    className={`h-1 w-1 rounded-full ${
                      ada ? (isSelected ? "bg-white" : "bg-emerald-500") : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {hariIni ? (
            <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold capitalize text-gray-700">
                  {tglLaporanID(hariIni.tanggal)}
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  {totalOrangTim(hariIni.tims)} orang
                </span>
              </div>
              <pre className="whitespace-pre-wrap rounded-lg bg-white p-3 font-sans text-xs text-gray-600">
                {laporanTeks(hariIni.tanggal, hariIni.tims)}
              </pre>
              <button
                type="button"
                onClick={salin}
                className="mt-2 text-xs font-semibold text-brand active:opacity-70"
              >
                {salinAt === hariIni.tanggal ? "Tersalin ✓" : "Salin Laporan"}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-center text-xs text-gray-400">
              {riwayat.length === 0 ? "Belum ada riwayat laporan." : "Ketuk tanggal bertitik hijau untuk lihat detail."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
