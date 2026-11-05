"use client";
import { useState } from "react";
import SelfieStampModal from "@/components/SelfieStampModal";
import { BUKA_MASUK_JAM, sudahBukaMasuk, formatJam } from "@/lib/absensiPegawaiAturan";

// Kartu "Absensi Saya" untuk akun yang wajib_absen: tap -> selfie berstempel
// lokasi -> clock in / clock out.
//
// Tidak ada pengecekan radius: pegawai boleh absen dari proyek mana pun.
// Jam resmi dibuat server (app/api/absensi-pegawai); jam di kartu ini hanya
// tampilan. Selfie ikut dikirim dan disimpan server untuk arsip PDF bulanan —
// lihat components/SelfieStampModal.jsx.
export default function AbsensiPegawaiCard({ nama, awal }) {
  const [data, setData] = useState(awal || null); // baris absen hari ini
  const [kamera, setKamera] = useState(null);     // "masuk" | "pulang" | null
  const [pesan, setPesan] = useState("");

  const mode = data?.keluar_at ? "selesai" : data?.masuk_at ? "masuk" : "idle";
  const bukaMasuk = sudahBukaMasuk();
  const nonaktif = mode === "selesai" || (mode === "idle" && !bukaMasuk);

  const kirim = async (aksi, posisi) => {
    const form = new FormData();
    form.set("aksi", aksi);
    form.set("lat", String(posisi.lat));
    form.set("lng", String(posisi.lng));
    if (posisi.accuracy != null) form.set("accuracy", String(posisi.accuracy));
    form.set("foto", posisi.foto, "selfie.jpg");
    const res = await fetch("/api/absensi-pegawai", { method: "POST", body: form });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return j.error || "Gagal menyimpan absen";
    setData((d) =>
      aksi === "masuk"
        ? {
            masuk_at: j.masuk_at,
            lokasi_masuk: j.lokasi_masuk,
            terlambat: j.terlambat,
            lat_masuk: posisi.lat,
            lng_masuk: posisi.lng,
          }
        : {
            ...d,
            keluar_at: j.keluar_at,
            lokasi_keluar: j.lokasi_keluar,
            pulang_cepat: j.pulang_cepat,
            lat_keluar: posisi.lat,
            lng_keluar: posisi.lng,
          }
    );
    setKamera(null);
    const tercatat = aksi === "masuk" ? "Absen masuk tercatat ✓" : "Absen pulang tercatat ✓";
    setPesan(j.foto_tersimpan === false ? `${tercatat} (foto gagal tersimpan)` : tercatat);
    setTimeout(() => setPesan(""), j.foto_tersimpan === false ? 6000 : 3000);
    return null;
  };

  const label = {
    idle: {
      judul: bukaMasuk ? "Belum Absen" : `Absen mulai jam ${String(BUKA_MASUK_JAM).padStart(2, "0")}:00`,
      sub: bukaMasuk ? "Tap untuk selfie & absen masuk" : "Belum waktunya",
      tombol: "ABSEN\nMASUK",
      badge: ["BELUM", "bg-gray-100 text-gray-500"],
    },
    masuk: {
      judul: data?.terlambat ? "Sudah Masuk · Terlambat" : "Sudah Masuk · Tepat Waktu",
      sub: "Tap untuk selfie & absen pulang",
      tombol: "ABSEN\nPULANG",
      badge: ["MASUK", "bg-amber-100 text-amber-700"],
    },
    selesai: {
      judul: data?.pulang_cepat ? "Sudah Pulang · Lebih Awal" : "Sudah Pulang",
      sub: "Absensi selesai hari ini",
      tombol: "SELESAI",
      badge: ["SELESAI", "bg-green-100 text-green-700"],
    },
  }[mode];

  const warnaTombol =
    mode === "idle"
      ? "glass-orb"
      : mode === "masuk"
      ? "bg-gradient-to-br from-amber-400 to-orange-500"
      : "bg-gradient-to-br from-green-400 to-emerald-500";

  return (
    <div className="card mb-3 flex flex-col items-center gap-3 p-6 text-center">
      <div className="flex w-full items-center justify-between">
        <p className="text-sm font-bold text-gray-700">Absensi Saya</p>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${label.badge[1]}`}>
          {label.badge[0]}
        </span>
      </div>

      <button
        onClick={() => !nonaktif && setKamera(mode === "idle" ? "masuk" : "pulang")}
        disabled={nonaktif}
        className={`my-1 flex h-28 w-28 flex-col items-center justify-center gap-0.5 rounded-full shadow-lg transition-all duration-300 active:scale-95 disabled:opacity-60 ${warnaTombol}`}
      >
        <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          {mode === "selesai" ? (
            <path d="M5 13l4 4L19 7" />
          ) : (
            <>
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </>
          )}
        </svg>
        <span className="whitespace-pre-line text-[11px] font-bold leading-tight text-white">{label.tombol}</span>
      </button>

      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-600">{pesan || label.judul}</p>
        {pesan && <p className="text-xs text-gray-400">{label.sub}</p>}
      </div>

      <div className="mt-1 grid w-full grid-cols-2 divide-x divide-amber-200 rounded-xl border border-amber-200 bg-amber-50/50 py-2.5">
        <Stat value={formatJam(data?.masuk_at)} label="Masuk" />
        <Stat value={formatJam(data?.keluar_at)} label="Pulang" />
      </div>

      {(data?.lokasi_masuk || data?.lokasi_keluar) && (
        <p className="w-full text-left text-[11px] text-gray-400">
          {data.lokasi_masuk && <>Masuk: {data.lokasi_masuk}</>}
          {data.lokasi_masuk && data.lokasi_keluar && " · "}
          {data.lokasi_keluar && <>Pulang: {data.lokasi_keluar}</>}
        </p>
      )}

      {kamera && (
        <SelfieStampModal
          judul={kamera === "masuk" ? "Selfie Absen Masuk" : "Selfie Absen Pulang"}
          nama={nama}
          onKonfirmasi={(posisi) => kirim(kamera, posisi)}
          onClose={() => setKamera(null)}
        />
      )}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      <p className="text-sm font-bold tabular-nums text-gray-700">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}
