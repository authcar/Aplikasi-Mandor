"use client";
import { useState, useEffect, useMemo } from "react";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function hitungStreak(checkinSet) {
  const today = new Date();
  let streak = 0;
  const d = new Date(today);
  d.setDate(d.getDate() - 1);

  for (let i = 0; i < 90; i++) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      d.setDate(d.getDate() - 1);
      continue;
    }
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    if (!checkinSet.has(dateStr)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default function CalendarPotongan({
  chatId,
  initialPotongan = [],
  initialCheckin = [],
}) {
  const today = new Date();
  const initialMonth = today.getMonth();
  const initialYear = today.getFullYear();

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [absenDates, setAbsenDates] = useState(
    new Set(initialPotongan.map((r) => r.tanggal)),
  );
  const [hadirDates, setHadirDates] = useState(
    new Set(initialCheckin.map((r) => r.tanggal)),
  );
  const [loading, setLoading] = useState(false);

  const streak = useMemo(
    () => hitungStreak(new Set(initialCheckin.map((r) => r.tanggal))),
    [initialCheckin],
  );

  useEffect(() => {
    if (year === initialYear && month === initialMonth) {
      setAbsenDates(new Set(initialPotongan.map((r) => r.tanggal)));
      setHadirDates(new Set(initialCheckin.map((r) => r.tanggal)));
      return;
    }
    const bulanStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    setLoading(true);
    fetch(`/api/potongan?bulan=${bulanStr}`)
      .then((r) => r.json())
      .then((data) => {
        setAbsenDates(new Set((data.potongan || []).map((r) => r.tanggal)));
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

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const bulanLabel = new Date(year, month, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const isCurrentMonth = year === initialYear && month === initialMonth;

  return (
    <div className="card p-4">
      {isCurrentMonth && streak > 0 && (
        <div className="mb-4 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 flex items-center gap-3">
          <span className="text-3xl">🔥</span>
          <div>
            <p className="font-bold text-orange-700">{streak} hari beruntun lapor!</p>
            <p className="text-sm text-orange-500">Pertahankan laporan harian Anda</p>
          </div>
        </div>
      )}
      {isCurrentMonth && streak === 0 && (
        <div className="mb-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">💪</span>
          <p className="text-sm text-gray-500">Mulai dengan mengisi laporan hari ini!</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="text-xl text-gray-400 px-2 active:text-gray-700">‹</button>
        <p className="font-bold text-gray-800">{bulanLabel}</p>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="text-xl text-gray-400 px-2 active:text-gray-700 disabled:opacity-30"
        >›</button>
      </div>

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
                <span
                  className={`
                    w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all
                    ${isToday && isHadir ? "bg-blue-600 text-white font-bold ring-2 ring-blue-300" : ""}
                    ${isToday && isAbsen ? "bg-red-500 text-white font-bold ring-2 ring-red-300" : ""}
                    ${!isToday && isHadir ? "border-2 border-blue-400 text-blue-700 font-semibold" : ""}
                    ${!isToday && isAbsen ? "border-4 border-red-400 text-red-600 font-semibold" : ""}
                    ${isLibur && !isToday ? "text-gray-200" : ""}
                    ${!isPast && !isToday ? "text-gray-300" : ""}
                  `}
                >
                  {d}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex gap-4 justify-center text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full border-2 border-blue-400 inline-block" />
          Sudah laporan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full border-4 border-red-400 inline-block" />
          Tidak laporan
        </span>
      </div>
    </div>
  );
}
