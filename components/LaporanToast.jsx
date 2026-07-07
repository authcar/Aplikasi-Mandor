"use client";
import { useState, useEffect } from "react";

// Notifikasi kecil melayang di pojok kanan atas.
// Muncul saat user belum membuat laporan/absen; bisa ditutup dengan ✕.
// href opsional — kalau diisi, teks jadi tautan (mis. ke bot Telegram).
export default function LaporanToast({
  show,
  message = "Kamu belum membuat laporan hari ini",
  href = "https://t.me/TaracoBot",
}) {
  const [open, setOpen] = useState(true);
  const [masuk, setMasuk] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMasuk(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (!show || !open) return null;

  return (
    <div
      className={`absolute right-3 top-3 z-[90] flex items-center gap-2 rounded-full border border-amber-200 bg-white/95 py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur transition-all duration-500 ${
        masuk ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
      }`}
    >
      <span className="text-base leading-none">😟</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-gray-700 active:text-brand"
        >
          {message}
        </a>
      ) : (
        <p className="text-xs font-semibold text-gray-700">{message}</p>
      )}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-full p-1 text-gray-400 active:bg-gray-100"
        aria-label="Tutup notifikasi"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
