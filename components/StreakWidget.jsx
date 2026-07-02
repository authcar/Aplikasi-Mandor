export default function StreakWidget({ potongan = [], checkin = [] }) {
  const today = new Date();

  // Streak: hitung mundur dari kemarin berdasarkan checkin_harian
  const checkinSet = new Set(checkin.map((r) => r.tanggal));
  let streak = 0;
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 90; i++) {
    if (d.getDay() === 0) { d.setDate(d.getDate() - 1); continue; }
    const s = d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    if (!checkinSet.has(s)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }

  const totalAbsen = potongan.length;
  const totalPersen = potongan.reduce((s, r) => s + Number(r.persentase), 0);
  const sudahLapor = checkin.length;

  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="flex flex-col items-center justify-center rounded-xl bg-orange-50 px-4 py-2 min-w-[72px]">
        <span className="text-2xl leading-none">🔥</span>
        <p className="text-lg font-bold text-orange-600 leading-tight">{streak}</p>
        <p className="text-[10px] text-orange-400">hari streak</p>
      </div>

      <div className="h-10 w-px bg-gray-100" />

      <div className="flex flex-1 gap-3">
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-red-500">{totalAbsen}</p>
          <p className="text-[11px] text-gray-400">hari absen</p>
        </div>
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-red-500">−{totalPersen}%</p>
          <p className="text-[11px] text-gray-400">potongan</p>
        </div>
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-blue-500">{sudahLapor}</p>
          <p className="text-[11px] text-gray-400">sudah lapor</p>
        </div>
      </div>
    </div>
  );
}
