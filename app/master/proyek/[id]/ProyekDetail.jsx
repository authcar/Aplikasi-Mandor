import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import RiwayatLaporanHarianCard from "@/app/supervisor/laporan-harian/RiwayatLaporanHarianCard";
import EditableAngkaField from "./EditableAngkaField";

// Sama dengan STATUS_BADGE di app/supervisor/laporan-harian/RiwayatLaporanHarianCard.jsx
const STATUS_BADGE = {
  ON_PROGRESS: { label: "Sedang Dikerjakan", cls: "bg-blue-100 text-blue-700" },
  DONE: { label: "Selesai", cls: "bg-green-100 text-green-700" },
  PERBAIKAN: { label: "Perlu Perbaikan", cls: "bg-red-100 text-red-700" },
};

const labelTanggal = (tgl) =>
  new Date(`${tgl}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

// Sebagian besar data proyek datang dari Taraco (satu-satunya sumber) dan
// read-only di sini — kecuali nilai_proyek (Nilai Jasa Tukang) & sisa_budget
// (Sisa Budget) yang bisa diinput manual oleh Master lewat EditableAngkaField.
// `riwayat` dari laporan_harian (laporan manual Supervisor), terurut terbaru dulu.
export default function ProyekDetail({ proyek, jumlahHadir, jumlahTim = 0, riwayat = [] }) {
  const laporanTerakhir = riwayat[0] || null;

  return (
    <main className="p-4 pb-8">
      <BackButton href="/master" />
      <header className="mb-5 flex items-center gap-3">
        <span className="icon-tile bg-brand-50 text-brand-600">
          <Icon name={proyek.icon || "building"} />
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{proyek.nama}</h1>
          <p className="flex items-center gap-1 text-sm text-gray-500">
            <Icon name="map-pin" className="h-4 w-4 shrink-0" />
            {proyek.lokasi || "—"}
          </p>
        </div>
      </header>

      <div className="card p-4 mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Hadir Hari Ini</p>
          <p className="text-2xl font-bold">
            {jumlahHadir === null ? "—" : `${jumlahHadir} orang`}
          </p>
        </div>
        <span className="icon-tile bg-green-100 text-green-600">
          <Icon name="check-circle" />
        </span>
      </div>

      <div className="card p-4 mb-5 space-y-3">
        <EditableAngkaField proyekId={proyek.id} field="nilai_proyek" label="Nilai Jasa Tukang" nilaiAwal={proyek.nilai_proyek} />
        <EditableAngkaField proyekId={proyek.id} field="sisa_budget" label="Sisa Budget" nilaiAwal={proyek.sisa_budget} />
        <div>
          <p className="label">Supervisor</p>
          <p className="text-lg font-semibold">{proyek.supervisor?.name || "— Belum ditetapkan —"}</p>
        </div>
        <div>
          <p className="label">Mandor Penanggung Jawab</p>
          <p className="text-lg font-semibold">{proyek.mandor?.name || "— Belum ditetapkan —"}</p>
        </div>
      </div>

      <div className="card p-4 mb-5 space-y-2">
        <p className="font-bold text-gray-700 text-sm">Laporan Terakhir</p>
        {laporanTerakhir ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm capitalize text-gray-500">{labelTanggal(laporanTerakhir.tanggal)}</p>
              <span
                className={`badge shrink-0 !text-[11px] ${(STATUS_BADGE[laporanTerakhir.status] || STATUS_BADGE.ON_PROGRESS).cls}`}
              >
                {(STATUS_BADGE[laporanTerakhir.status] || STATUS_BADGE.ON_PROGRESS).label}
              </span>
            </div>
            <p className="line-clamp-2 text-sm text-gray-600">{laporanTerakhir.deskripsi}</p>
          </>
        ) : (
          <p className="text-sm text-gray-400">Belum ada laporan harian dari Supervisor untuk proyek ini.</p>
        )}
      </div>

      <RiwayatLaporanHarianCard riwayat={riwayat} />
    </main>
  );
}
