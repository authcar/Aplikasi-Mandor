"use client";
import { useState, useEffect } from "react";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const POTONGAN_PER_HARI = 0.5; // % per hari absen

function hariKerja(year, month, sampaiTanggal) {
  // Senin–Jumat dihitung hari kerja
  const hasil = [];
  const batas = new Date(sampaiTanggal);
  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
    const tgl = new Date(year, month, d);
    if (tgl > batas) break;
    if (tgl.getDay() !== 0 && tgl.getDay() !== 6) { // bukan Sabtu/Minggu
      hasil.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }
  return hasil;
}

export default function KalenderAbsensiMandor({ initialCheckin = [], gajiPokok = 0 }) {
  const today = new Date();
  const initialMonth = today.getMonth();
  const initialYear = today.getFullYear();

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [hadirDates, setHadirDates] = useState(new Set(initialCheckin.map((r) => r.tanggal)));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (year === initialYear && month === initialMonth) {
      setHadirDates(new Set(initialCheckin.map((r) => r.tanggal)));
      return;
    }
    const bulanStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    setLoading(true);
    fetch(`/api/absensi-mandor?bulan=${bulanStr}`)
      .then((r) => r.json())
      .then((data) => {
        setHadirDates(new Set((data.checkin || []).map((r) => r.tanggal)));
        setLoading(false);
      });
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = today.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const isCurrentMonth = year === initialYear && month === initialMonth;

  // Hitung hari absen & potongan
  const kerja = hariKerja(year, month, todayStr);
  const absenDates = kerja.filter((d) => !hadirDates.has(d));
  const totalPotongan = absenDates.length * POTONGAN_PER_HARI;
  const nominalPotongan = gajiPokok * (totalPotongan / 100);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const bulanLabel = new Date(year, month, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const rupiah = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <div className="card p-4">
      {/* Ringkasan potongan */}
      {absenDates.length > 0 ? (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="font-bold text-red-700">{absenDates.length} hari absen bulan ini</p>
          <p className="text-sm text-red-500">
            Potongan {totalPotongan}%
            {gajiPokok > 0 && ` · −${rupiah(nominalPotongan)}`}
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-2">
          <span className="text-xl">✅</span>
          <p className="text-sm font-semibold text-green-700">Tidak ada absen bulan ini</p>
        </div>
      )}

      {/* Navigasi bulan */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="text-xl text-gray-400 px-2 active:text-gray-700">‹</button>
        <p className="font-bold text-gray-800">{bulanLabel}</p>
        <button onClick={nextMonth} disabled={isCurrentMonth} className="text-xl text-gray-400 px-2 active:text-gray-700 disabled:opacity-30">›</button>
      </div>

      {/* Header hari */}
      <div className="grid grid-cols-7 mb-1">
        {HARI.map((h) => (
          <div key={h} className="text-center text-xs font-semibold text-gray-400 py-1">{h}</div>
        ))}
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">Memuat...</div>
      ) : (
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`e-${i}`} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const dayOfWeek = (firstDay + d - 1) % 7;
            const isLibur = dayOfWeek === 0 || dayOfWeek === 6; // Sabtu & Minggu
            const isPast = dateStr < todayStr;
            const isToday = dateStr === todayStr;
            const isHadir = hadirDates.has(dateStr);
            const isAbsen = !isLibur && (isPast || isToday) && !isHadir;

            return (
              <div key={dateStr} className="flex flex-col items-center py-0.5">
                <span className={`
                  w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium
                  ${isToday && isHadir  ? "bg-green-500 text-white font-bold ring-2 ring-green-300" : ""}
                  ${isToday && isAbsen  ? "bg-red-500 text-white font-bold ring-2 ring-red-300" : ""}
                  ${isToday && isLibur ? "bg-gray-100 text-gray-300 font-bold" : ""}
                  ${!isToday && isHadir ? "border-2 border-green-400 text-green-700 font-semibold" : ""}
                  ${!isToday && isAbsen ? "border-4 border-red-400 text-red-600 font-semibold" : ""}
                  ${isLibur && !isToday ? "text-gray-200" : ""}
                  ${!isPast && !isToday ? "text-gray-300" : ""}
                `}>
                  {d}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex gap-4 justify-center text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full border-2 border-green-400 inline-block" />
          Hadir
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full border-4 border-red-400 inline-block" />
          Absen (−{POTONGAN_PER_HARI}%)
        </span>
      </div>
    </div>
  );
}
