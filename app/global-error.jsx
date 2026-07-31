"use client";

import Icon from "@/components/Icon";
import "./globals.css";

// Menangani error di root layout (app/layout.jsx) itu sendiri — kasus yang
// tidak bisa ditangkap app/error.jsx. Harus menyediakan <html>/<body> sendiri
// karena root layout tidak jadi dirender.
export default function GlobalError({ reset }) {
  return (
    <html lang="id">
      <body>
        <div className="relative mx-auto min-h-screen max-w-md bg-slate-50 shadow-soft sm:my-0">
          <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="icon-tile bg-red-100 text-red-600">
              <Icon name="alert-triangle" className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Terjadi Kesalahan</h1>
              <p className="mt-1 text-sm text-gray-500">
                Aplikasi gagal dimuat. Coba muat ulang halaman.
              </p>
            </div>
            <button onClick={() => reset()} className="btn-primary w-full max-w-xs">
              Coba Lagi
            </button>
          </main>
        </div>
      </body>
    </html>
  );
}
