"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Titik acuan GPS proyek — dipakai untuk memvalidasi absen kunjungan
// Supervisor (lihat app/api/kunjungan/route.js).
//
// Titik ini TIDAK berasal dari kolom `lokasi`: separuh proyek aktif nilainya
// null dan yang terisi cuma turun sampai level gedung/cluster, jadi tidak
// cukup akurat untuk geofence.
//
// Ada dua jalur menetapkannya, dan yang di kartu ini yang lebih dipercaya:
//
//   • Master menempel koordinat dari Google Maps (PUT /api/proyek/titik).
//   • Posisi Supervisor pertama yang absen masuk (app/api/kunjungan/route.js).
//
// Jalur kedua punya cacat yang tidak bisa ditutup dengan pengaman tambahan:
// yang menetapkan titik adalah orang yang juga dinilai oleh titik itu. Ia
// dibiarkan hidup supaya lapangan tidak terhambat saat Master belum sempat
// mengisi, bukan karena setara — dan justru karena itu tombol reset di sini
// tetap perlu.
export default function TitikProyekCard({ proyek }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [error, setError] = useState("");
  const [teks, setTeks] = useState("");
  const [simpanLoading, setSimpanLoading] = useState(false);
  const [sukses, setSukses] = useState("");

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

  // Teks mentahnya dikirim apa adanya — penguraiannya di server (lihat
  // uraikanKoordinat di lib/geo.js). Diurai di sini dulu berarti aturannya
  // hidup di dua tempat, dan yang di client bisa dilewati.
  const simpan = async () => {
    setSimpanLoading(true);
    setError("");
    setSukses("");
    const res = await fetch("/api/proyek/titik", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proyek.id, koordinat: teks }),
    });
    const json = await res.json().catch(() => ({}));
    setSimpanLoading(false);
    if (!res.ok) {
      setError(json.error || "Gagal menyimpan titik.");
      return;
    }
    setTeks("");
    setSukses("Titik tersimpan ✓");
    setTimeout(() => setSukses(""), 3000);
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
                Radius {proyek.radius_meter ?? 500}m
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
          {sukses && <p className="mt-1 text-xs font-medium text-green-600">{sukses}</p>}
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

      <div className="mt-3 border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-gray-600">
          {punyaTitik ? "Ubah titik dari Google Maps" : "Tetapkan titik dari Google Maps"}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-gray-400">
          Buka Google Maps, klik kanan tepat di lokasi proyek, lalu klik koordinat yang muncul untuk
          menyalinnya. Tempel di sini — link Google Maps juga bisa. Tidak perlu berada di lokasi.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={teks}
            onChange={(e) => setTeks(e.target.value)}
            placeholder="-6.215008, 106.736006"
            className="input !py-2 min-w-0 flex-1 font-mono text-xs"
          />
          <button
            onClick={simpan}
            disabled={simpanLoading || !teks.trim()}
            className="shrink-0 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white active:bg-brand-800 disabled:opacity-50"
          >
            {simpanLoading ? "…" : "Simpan"}
          </button>
        </div>
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
