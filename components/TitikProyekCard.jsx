"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Titik acuan GPS proyek — dipakai untuk memvalidasi absen kunjungan
// Supervisor (lihat app/api/kunjungan/route.js).
//
// Titik ini TIDAK berasal dari kolom `lokasi`: separuh proyek aktif nilainya
// null dan yang terisi cuma turun sampai level gedung/cluster, jadi tidak
// cukup akurat untuk geofence. Titiknya ditetapkan dari posisi orang pertama
// yang absen masuk — dan justru karena itu perlu tombol reset di sini, kalau
// orang pertama ternyata absen dari luar lokasi.
export default function TitikProyekCard({ proyek }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [error, setError] = useState("");

  const punyaTitik = proyek.lat != null && proyek.lng != null;

  const reset = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/proyek/titik", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proyek.id }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Gagal menghapus titik.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="card mb-5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-700">Titik Absen Kunjungan</p>
          {punyaTitik ? (
            <>
              <p className="mt-0.5 font-mono text-xs text-gray-500">
                {proyek.lat.toFixed(6)}, {proyek.lng.toFixed(6)}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                Radius {proyek.radius_meter ?? 300}m
                {proyek.penyet?.name ? ` · diset oleh ${proyek.penyet.name}` : ""}
                {proyek.titik_diset_at
                  ? ` · ${new Date(proyek.titik_diset_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Jakarta",
                    })}`
                  : ""}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-gray-400">
              Belum diset. Titiknya ditetapkan otomatis saat Supervisor pertama absen masuk di lokasi.
            </p>
          )}
          {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
        </div>

        {punyaTitik && (
          <button
            onClick={() => setKonfirmasi(true)}
            disabled={loading}
            className="shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 active:bg-red-50 disabled:opacity-50"
          >
            Reset
          </button>
        )}
      </div>

      {konfirmasi && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-base font-bold text-gray-800">Reset titik proyek?</p>
            <p className="mt-1 text-sm text-gray-500">
              Absen masuk Supervisor berikutnya di {proyek.nama} akan menetapkan titik baru dari posisinya
              saat itu. Kunjungan yang sudah tercatat tidak berubah.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setKonfirmasi(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 active:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setKonfirmasi(false);
                  reset();
                }}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white active:bg-red-700"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
