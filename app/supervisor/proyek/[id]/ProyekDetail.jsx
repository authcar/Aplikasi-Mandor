import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";

// Read-only — data proyek datang dari Taraco (satu-satunya sumber),
// tidak bisa diedit lagi di Aplikasi Mandor.
export default function ProyekDetail({ proyek, jumlahHadir }) {
  return (
    <main className="p-4 pb-8">
      <BackButton href="/supervisor" />
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
        <p className="font-bold text-gray-700 text-sm">Info Proyek (dari Taraco)</p>
        <div>
          <p className="label">Mandor Penanggung Jawab</p>
          <p className="text-lg font-semibold">{proyek.mandor?.name || "— Belum ditetapkan —"}</p>
        </div>
      </div>
    </main>
  );
}
