import BackButton from "@/components/BackButton";

// Daftar hadir hari ini — read-only, sumbernya laporan absensi_tim yang
// diinput Supervisor (bukan input mandor sendiri lagi, lihat AbsensiTimForm).
export default function DaftarHadirCard({ proyek, tims = [], totalOrang = 0 }) {
  if (!proyek) return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <main className="p-4 pb-8">
      <BackButton href={`/mandor?proyek=${proyek.id}`} />
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">Absensi Hari Ini</h1>
        <p className="text-sm text-gray-500">{proyek.nama} · dari laporan Supervisor</p>
      </header>

      <div className="card mb-4 flex items-center justify-between p-4">
        <p className="text-sm text-gray-500">Total orang hadir</p>
        <p className="text-2xl font-bold text-emerald-600">{totalOrang}</p>
      </div>

      {tims.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400">
          Supervisor belum input absensi untuk proyek ini hari ini.
        </div>
      ) : (
        <div className="space-y-3">
          {tims.map((t, i) => (
            <div key={i} className="card p-4">
              <p className="mb-2 font-semibold text-gray-700">{t.nama}</p>
              <div className="space-y-1.5">
                {t.lines.map((l, j) => (
                  <div key={j} className="flex items-center gap-2 text-sm">
                    <span className="flex h-6 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-xs font-bold text-brand">
                      {l.jumlah ?? 1}
                    </span>
                    <span className="text-gray-600">{l.kegiatan}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
