export default function StreakWidget({ potongan = [], checkin = [], laporanHarian = null }) {
  // Hari kerja supervisor (Senin–Sabtu) bulan ini sampai hari ini, zona WIB
  const wibStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const [y, m, d] = wibStr.split("-").map(Number);
  const laporanDateSet = laporanHarian ? new Set(laporanHarian.map((r) => r.tanggal)) : null;

  // hariKerja: jumlah hari Senin-Sabtu bulan ini s/d hari ini.
  // hariKerjaLapor: dari hariKerja itu, berapa yang sudah ada laporan manual
  // (laporan yang diisi di hari Minggu/libur sengaja tidak dihitung di sini,
  // karena tidak "menutupi" kewajiban laporan hari kerja lain).
  let hariKerja = 0;
  let hariKerjaLapor = 0;
  for (let i = 1; i <= d; i++) {
    const day = new Date(y, m - 1, i).getDay();
    if (day === 0) continue;
    hariKerja++;
    if (laporanDateSet) {
      const tgl = `${y}-${String(m).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      if (laporanDateSet.has(tgl)) hariKerjaLapor++;
    }
  }

  // totalAbsenLama & totalPersenLama: sistem lama (potongan_gaji, berbasis bot
  // Telegram) — disimpan sebagai fallback, tidak dipakai lagi untuk tampilan
  // utama sekarang "hari absen" & "potongan" dihitung dari laporan manual.
  const totalAbsenLama = potongan.length;
  const totalPersenLama = potongan.reduce((s, r) => s + Number(r.persentase), 0);

  // Sumber utama "sudah lapor": jumlah tanggal unik di laporan_harian bulan
  // ini (termasuk kalau ada yang dilapor di hari libur — ini angka aktivitas,
  // beda dengan hariKerjaLapor yang khusus hari kerja). Kalau laporanHarian
  // tidak dikirim (null), fallback ke checkin_harian (sistem lama Telegram).
  const sudahLapor = laporanDateSet ? laporanDateSet.size : checkin.length;

  // "Hari absen" = hari kerja yang belum ada laporan manual. Fallback ke
  // totalAbsenLama (potongan_gaji) kalau laporanHarian tidak dikirim.
  const totalAbsen = laporanDateSet ? hariKerja - hariKerjaLapor : totalAbsenLama;

  // "Potongan %" ikut pola lama (0.5% per hari absen), dihitung dari hari
  // absen versi laporan manual di atas. Fallback ke totalPersenLama (jumlah
  // persentase asli dari potongan_gaji) kalau laporanHarian tidak dikirim.
  const totalPersen = laporanDateSet ? totalAbsen * 0.5 : totalPersenLama;

  // "Rajin lapor %" pakai hariKerjaLapor (bukan sudahLapor) supaya konsisten
  // dengan "hari absen" — sama-sama berbasis cakupan hari kerja.
  const persen = hariKerja
    ? Math.min(100, Math.round(((laporanDateSet ? hariKerjaLapor : sudahLapor) / hariKerja) * 100))
    : 100;
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
