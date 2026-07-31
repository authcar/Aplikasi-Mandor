"use client";

import Icon from "@/components/Icon";

// Menangkap error di page/layout mana pun di bawah root layout (app/layout.jsx).
// Untuk error di root layout itu sendiri, lihat app/global-error.jsx.
export default function Error({ reset }) {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="icon-tile bg-red-100 text-red-600">
        <Icon name="alert-triangle" className="h-7 w-7" />
      </div>
      <div>
        <h1 className="text-lg font-bold tracking-tight">Terjadi Kesalahan</h1>
        <p className="mt-1 text-sm text-gray-500">
          Halaman ini gagal dimuat. Coba lagi, atau kembali ke beranda kalau masalah berlanjut.
        </p>
      </div>
      <div className="grid w-full max-w-xs grid-cols-2 gap-2">
        <a href="/" className="btn-outline">
          Beranda
        </a>
        <button onClick={() => reset()} className="btn-primary">
          Coba Lagi
        </button>
      </div>
    </main>
  );
}
