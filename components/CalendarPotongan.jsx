"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function hitungStreak(absenSet) {
  const today = new Date();
  let streak = 0;
  const d = new Date(today);
  // Mulai dari kemarin (hari ini belum tentu sudah laporan)
  d.setDate(d.getDate() - 1);

  for (let i = 0; i < 90; i++) {
    const dayOfWeek = d.getDay(); // 0=Min, 6=Sab
    if (dayOfWeek === 0) { // Skip Minggu
      d.setDate(d.getDate() - 1);
      continue;
    }
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    if (absenSet.has(dateStr)) break; // Ketemu hari absen, streak berhenti
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default function CalendarPotongan({ nama, initialRows = [] }) {
  const today = new Date();
  const initialMonth = today.getMonth();
  const initialYear = today.getFullYear();

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [absenDates, setAbsenDates] = useState(
    new Set(initialRows.map((r) => r.tanggal))
  );
  const [loading, setLoading] = useState(false);

  // Streak dihitung dari semua data bulan ini (initialRows)
  const streak = useMemo(() => hitungStreak(new Set(initialRows.map((r) => r.tanggal))), [initialRows]);

  useEffect(() => {
    if (year === initialYear && month === initialMonth) {
      setAbsenDates(new Set(initialRows.map((r) => r.tanggal)));
      return;
    }
    if (!nama) return;
    const supabase = createClient();
    const bulanStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    setLoading(true);
    supabase
      .from("potongan_gaji")
      .select("tanggal")
      .eq("nama", nama)
      .gte("tanggal", `${bulanStr}-01`)
      .lte("tanggal", `${bulanStr}-31`)
      .then(({ data }) => {
        setAbsenDates(new Set((data || []).map((r) => r.tanggal)));
        setLoading(false);
      });
  }, [nama, year, month]);

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

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const bulanLabel = new Date(year, month, 1).toLocaleDateString("id-ID", {
    month: "long", year: "numeric",
  });

  const isCurrentMonth = year === initialYear && month === initialMonth;

  return (
    <div className="card p-4">
      {/* Streak banner */}
      {isCurrentMonth && streak > 0 && (
        <div className="mb-4 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 flex items-center gap-3">
          <span className="text-3xl">🔥</span>
          <div>
            <p className="font-bold text-orange-700">{streak} hari streak!</p>
            <p className="text-sm text-orange-500">Pertahankan laporan harian Anda</p>
          </div>
        </div>
      )}
      {isCurrentMonth && streak === 0 && (
        <div className="mb-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">💪</span>
          <p className="text-sm text-gray-500">Mulai streak dengan laporan hari ini!</p>
        </div>
      )}

      {/* Header navigasi */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="text-xl text-gray-400 px-2 active:text-gray-700">‹</button>
        <p className="font-bold text-gray-800">{bulanLabel}</p>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="text-xl text-gray-400 px-2 active:text-gray-700 disabled:opacity-30"
        >›</button>
      </div>

      {/* Nama hari */}
      <div className="grid grid-cols-7 mb-1">
        {HARI.map((h) => (
          <div key={h} className="text-center text-xs font-semibold text-gray-400 py-1">{h}</div>
        ))}
      </div>

      {/* Grid tanggal */}
      {loading ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">Memuat...</div>
      ) : (
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`e-${i}`} />;

            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const dayOfWeek = (firstDay + d - 1) % 7;
            const isSunday = dayOfWeek === 0;
            const isPast = dateStr < todayStr;
            const isToday = dateStr === todayStr;
            const isAbsen = absenDates.has(dateStr);
            const isHadir = !isSunday && isPast && !isAbsen;

            let dotColor = "";
            if (isAbsen) dotColor = "bg-red-500";
            else if (isHadir) dotColor = "bg-blue-500";

            return (
              <div key={dateStr} className="flex flex-col items-center py-1 gap-1">
                <span
                  className={`
                    w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium
                    ${isToday ? "bg-blue-600 text-white font-bold" : ""}
                    ${isSunday && !isToday ? "text-gray-300" : ""}
                    ${!isSunday && !isToday ? "text-gray-700" : ""}
                  `}
                >
                  {d}
                </span>
                {dotColor && !isToday && (
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                )}
                {isToday && isAbsen && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex gap-4 justify-center text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Sudah laporan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Tidak laporan
        </span>
      </div>
    </div>
  );
}
