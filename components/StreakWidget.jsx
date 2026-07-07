export default function StreakWidget({ potongan = [], checkin = [] }) {
  // Hari kerja supervisor (Senin–Sabtu) bulan ini sampai hari ini, zona WIB
  const wibStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const [y, m, d] = wibStr.split("-").map(Number);
  let hariKerja = 0;
  for (let i = 1; i <= d; i++) {
    const day = new Date(y, m - 1, i).getDay();
    if (day !== 0) hariKerja++;
  }

  const totalAbsen = potongan.length;
  const totalPersen = potongan.reduce((s, r) => s + Number(r.persentase), 0);
  const sudahLapor = checkin.length;

  const persen = hariKerja ? Math.min(100, Math.round((sudahLapor / hariKerja) * 100)) : 100;
  // Emot mood: makin rajin lapor, makin senang 😄
  const level =
    persen >= 100
      ? { emoji: "🤩", bg: "bg-emerald-50", text: "text-emerald-600", sub: "text-emerald-400" }
      : persen >= 80
        ? { emoji: "😄", bg: "bg-emerald-50", text: "text-emerald-600", sub: "text-emerald-400" }
        : persen >= 60
          ? { emoji: "🙂", bg: "bg-lime-50", text: "text-lime-600", sub: "text-lime-400" }
          : persen >= 40
            ? { emoji: "😐", bg: "bg-amber-50", text: "text-amber-600", sub: "text-amber-400" }
            : persen >= 20
              ? { emoji: "😟", bg: "bg-orange-50", text: "text-orange-500", sub: "text-orange-300" }
              : { emoji: "😭", bg: "bg-red-50", text: "text-red-500", sub: "text-red-300" };

  return (
    <div className="card flex items-center gap-3 p-3">
      <div className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[76px] ${level.bg}`}>
        <span className="text-2xl leading-none">{level.emoji}</span>
        <p className={`text-lg font-bold leading-tight ${level.text}`}>{persen}%</p>
        <p className={`text-[10px] ${level.sub}`}>rajin lapor</p>
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
