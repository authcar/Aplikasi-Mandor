"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

// Kartu "Kunjungan Proyek" di dashboard Supervisor — absen masuk saat tiba di
// proyek, absen keluar saat pergi, yang dicatat adalah DURASI-nya.
//
// Sengaja bukan memakai ulang AbsensiSayaCard: kartu itu mengunci satu
// koordinat kantor dan modelnya satu absen per hari, sedangkan Supervisor
// pindah-pindah proyek dan bisa berkunjung beberapa kali sehari. Yang
// diwarisi cuma bahasa visualnya (tombol bulat + modal konfirmasi).
//
// Semua keputusan lokasi ada di server (app/api/kunjungan/route.js). Komponen
// ini hanya mengambil koordinat dari perangkat dan menampilkan jawabannya —
// jangan pindahkan pengecekan radius ke sini.

function formatJam(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
}

function formatDurasi(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "--:--";
  const menit = Math.floor(ms / 60000);
  return `${String(Math.floor(menit / 60)).padStart(2, "0")}:${String(menit % 60).padStart(2, "0")}`;
}

export default function KunjunganCard({ proyeks = [], kunjunganBerjalan = null }) {
  const router = useRouter();
  const [pilihan, setPilihan] = useState(proyeks[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState(null); // { teks, jenis: "error" | "sukses" }
  const [konfirmasi, setKonfirmasi] = useState(null); // { mode, judul, sub }
  const [sekarang, setSekarang] = useState(() => Date.now());
  const timerRef = useRef(null);

  const berjalan = !!kunjunganBerjalan;
  const proyekBerjalan = proyeks.find((p) => p.id === kunjunganBerjalan?.proyek_id);
  const proyekTerpilih = proyeks.find((p) => p.id === pilihan);

  // Timer durasi hanya hidup selama ada kunjungan berjalan.
  useEffect(() => {
    if (!berjalan) return;
    timerRef.current = setInterval(() => setSekarang(Date.now()), 1000);
    return () => clearInterval(timerRef.current);
  }, [berjalan]);

  const tampilkan = (teks, jenis = "error") => {
    setPesan({ teks, jenis });
    setTimeout(() => setPesan(null), 5000);
  };

  const ambilPosisi = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Perangkat ini tidak mendukung GPS"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        () => reject(new Error("Izinkan akses lokasi terlebih dahulu")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });

  const kirim = async (mode, { setTitik = false } = {}) => {
    setLoading(true);
    try {
      const c = await ambilPosisi();
      const payload = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy };

      const res = await fetch("/api/kunjungan", {
        method: mode === "masuk" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "masuk"
            ? { ...payload, proyek_id: pilihan, set_titik: setTitik }
            : { ...payload, id: kunjunganBerjalan.id }
        ),
      });
      const json = await res.json();

      // Proyek ini belum punya titik acuan — minta konfirmasi terpisah dulu,
      // karena menekan "Ya" di sini mengunci titiknya untuk semua orang.
      if (json.perlu_set_titik) {
        setLoading(false);
        setKonfirmasi({
          mode: "set-titik",
          judul: "Tetapkan titik proyek?",
          sub: `${json.proyek?.nama} belum punya titik acuan. Posisi Anda sekarang akan dijadikan titiknya — pastikan Anda benar-benar berada di lokasi proyek.`,
        });
        return;
      }

      if (!res.ok) {
        tampilkan(json.error || "Gagal menyimpan absen");
        setLoading(false);
        return;
      }

      tampilkan(
        mode === "masuk"
          ? json.titik_baru
            ? "Titik proyek tersimpan. Kunjungan dimulai ✓"
            : "Kunjungan dimulai ✓"
          : json.kunjungan?.status === "TIDAK_SAH"
            ? json.kunjungan.catatan_sistem
            : "Kunjungan selesai ✓",
        mode === "keluar" && json.kunjungan?.status === "TIDAK_SAH" ? "error" : "sukses"
      );
      router.refresh();
    } catch (err) {
      tampilkan(err.message);
    }
    setLoading(false);
  };

  const bukaKonfirmasi = () => {
    if (!berjalan && !pilihan) return tampilkan("Pilih proyek dulu");
    setKonfirmasi(
      berjalan
        ? {
            mode: "keluar",
            judul: "Absen keluar?",
            sub: `Anda sudah di ${proyekBerjalan?.nama || "proyek ini"} sejak ${formatJam(kunjunganBerjalan.mulai_at)}.`,
          }
        : {
            mode: "masuk",
            judul: "Absen masuk?",
            sub: proyekTerpilih?.lokasi
              ? `${proyekTerpilih.nama} — ${proyekTerpilih.lokasi}`
              : `${proyekTerpilih?.nama}. Pastikan Anda sudah berada di lokasi.`,
          }
    );
  };

  const durasi = berjalan ? formatDurasi(sekarang - new Date(kunjunganBerjalan.mulai_at).getTime()) : "--:--";

  return (
    <div className="relative">
      <div className="card mb-3 flex flex-col items-center gap-3 p-6 text-center">
        <div className="flex w-full items-center justify-between">
          <p className="text-sm font-bold text-gray-700">Kunjungan Proyek</p>
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
              berjalan ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {berjalan ? "DI LOKASI" : "BELUM"}
          </span>
        </div>

        {berjalan ? (
          <p className="w-full truncate text-sm font-semibold text-gray-700">
            {proyekBerjalan?.nama || "Proyek"}
          </p>
        ) : proyeks.length === 0 ? (
          <p className="w-full text-sm text-gray-400">Belum ada proyek aktif.</p>
        ) : (
          <select
            value={pilihan}
            onChange={(e) => setPilihan(e.target.value)}
            className="input !py-2 text-sm font-semibold"
          >
            {proyeks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
        )}

        <div className="relative my-1 flex shrink-0 items-center justify-center">
          <span
            className={`absolute h-28 w-28 animate-[breathe_2.2s_ease-in-out_infinite] rounded-full bg-gradient-to-br ${
              berjalan ? "from-amber-400 to-orange-500" : "from-brand via-indigo-400 to-purple-500"
            }`}
          />
          <button
            onClick={bukaKonfirmasi}
            disabled={loading || (!berjalan && proyeks.length === 0)}
            className={`relative z-10 flex h-28 w-28 flex-col items-center justify-center gap-0.5 rounded-full bg-gradient-to-br shadow-lg transition-all duration-300 active:scale-95 disabled:opacity-60 ${
              berjalan ? "from-amber-400 to-orange-500" : "from-brand to-indigo-500"
            }`}
          >
            {loading ? (
              <svg className="h-8 w-8 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <>
                <Icon name="map-pin" className="h-7 w-7 text-white" />
                <span className="whitespace-pre-line text-[11px] font-bold leading-tight text-white">
                  {berjalan ? "ABSEN\nKELUAR" : "ABSEN\nMASUK"}
                </span>
              </>
            )}
          </button>
        </div>

        <div className="min-w-0">
          <p
            className={`text-sm font-medium ${
              pesan?.jenis === "error"
                ? "text-red-600"
                : pesan?.jenis === "sukses"
                  ? "text-green-600"
                  : berjalan
                    ? "text-amber-600"
                    : "text-gray-500"
            }`}
          >
            {pesan?.teks || (berjalan ? "Sedang di lokasi" : "Tap untuk absen masuk")}
          </p>
          {!pesan && (
            <p className="truncate text-xs text-gray-400">
              {berjalan ? proyekBerjalan?.lokasi || "—" : "Lokasi diperiksa otomatis saat absen"}
            </p>
          )}
        </div>

        <div className="mt-1 grid w-full grid-cols-3 divide-x divide-amber-200 rounded-xl border border-amber-200 bg-amber-50/50 py-2.5">
          <Stat label="Masuk" value={formatJam(kunjunganBerjalan?.mulai_at)} />
          <Stat label="Durasi" value={durasi} />
          <Stat label="Status" value={berjalan ? "Aktif" : "—"} />
        </div>
      </div>

      {konfirmasi && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-base font-bold text-gray-800">{konfirmasi.judul}</p>
            <p className="mt-1 text-sm text-gray-500">{konfirmasi.sub}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setKonfirmasi(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 active:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const { mode } = konfirmasi;
                  setKonfirmasi(null);
                  if (mode === "set-titik") kirim("masuk", { setTitik: true });
                  else kirim(mode);
                }}
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-brand active:bg-brand-800"
              >
                Ya
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <p className="text-sm font-bold tabular-nums text-gray-700">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}
