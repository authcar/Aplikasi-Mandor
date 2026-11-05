"use client";
import { useState } from "react";

// Tombol unduh PDF absensi satu bulan. Pakai fetch (bukan tautan biasa) karena
// menyusun PDF bisa belasan detik: tombol perlu menampilkan "Menyiapkan…" dan
// pesan galat kalau gagal (mis. bulan itu belum ada absensi).
export default function UnduhPdfAbsensi({ bulan, sementara, kosong }) {
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");

  const unduh = async () => {
    setMemuat(true);
    setGalat("");
    try {
      const res = await fetch(`/api/absensi-pegawai/pdf?bulan=${bulan}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Gagal membuat PDF.");
      }
      const blob = await res.blob();
      const nama = (res.headers.get("Content-Disposition") || "").match(/filename="(.+?)"/)?.[1] || `Absensi ${bulan}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nama;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setGalat(e.message || "Gagal membuat PDF.");
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={unduh}
        disabled={memuat || kosong}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-brand active:bg-brand-800 disabled:opacity-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />
        </svg>
        {memuat ? "Menyiapkan PDF… (bisa sampai 30 detik)" : sementara ? "Unduh PDF (sementara)" : "Unduh PDF"}
      </button>
      {galat && <p className="mt-1.5 text-center text-xs text-red-600">{galat}</p>}
      {sementara && !galat && (
        <p className="mt-1.5 text-center text-[11px] text-gray-400">
          Bulan ini masih berjalan. PDF final dibuat otomatis setelah bulan berakhir.
        </p>
      )}
    </div>
  );
}
