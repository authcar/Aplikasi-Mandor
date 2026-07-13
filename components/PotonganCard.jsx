"use client";
import { useState } from "react";
import { rupiah } from "@/lib/format";

export default function PotonganCard({ rows = [], gajiPokok = 0, kasbon = 0 }) {
  const bulanIni = new Date().toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
  const [open, setOpen] = useState(false);

  const totalHari = rows.length;
  const totalPersen = rows.reduce((s, r) => s + Number(r.persentase), 0);
  const nominalPotongan = gajiPokok * (totalPersen / 100);
  const totalPotongan = nominalPotongan + kasbon;

  if (totalHari === 0 && kasbon === 0) {
    return (
      <div className="card p-4 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="font-bold text-green-700">Tidak Ada Potongan</p>
          <p className="text-sm text-gray-500">
            Semua laporan bulan ini sudah diisi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden border-l-4 border-red-400">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-4 text-left active:bg-gray-50"
      >
        <div>
          <p className="font-bold text-red-700">{bulanIni}</p>
          {totalHari > 0 && (
            <p className="text-sm text-gray-500">
              {totalHari} hari tidak laporan bulan ini
            </p>
          )}
          {kasbon > 0 && (
            <p className="text-sm text-gray-500">Kasbon disetujui bulan ini</p>
          )}
          {gajiPokok > 0 && (
            <p className="text-sm font-bold text-red-600 mt-0.5">
              −{rupiah(totalPotongan)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalPersen > 0 && <p className="text-lg font-bold text-red-600">−{totalPersen}%</p>}
          <span
            className={`text-xl text-gray-300 transition-transform ${open ? "rotate-90" : ""}`}
          >
            ›
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-red-50/50 px-4 pb-4 pt-3 space-y-2">
          {rows.map((r) => {
            const nom = gajiPokok * (Number(r.persentase) / 100);
            return (
              <div
                key={r.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-600">
                  {new Date(r.tanggal).toLocaleDateString("id-ID", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <div className="text-right">
                  <span className="font-bold text-red-600">
                    −{r.persentase}%
                  </span>
                  {gajiPokok > 0 && (
                    <span className="block text-xs text-red-400">
                      −{rupiah(nom)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {kasbon > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Kasbon disetujui</span>
              <span className="font-bold text-red-600">−{rupiah(kasbon)}</span>
            </div>
          )}
          <div className="mt-2 border-t border-red-200 pt-2 flex justify-between font-bold">
            <span>Total Potongan</span>
            <div className="text-right">
              {totalPersen > 0 && <span className="text-red-700">−{totalPersen}%</span>}
              {gajiPokok > 0 && (
                <span className="block text-sm text-red-500">
                  −{rupiah(totalPotongan)}
                </span>
              )}
            </div>
          </div>
          {gajiPokok > 0 && (
            <div className="flex justify-between text-sm text-gray-500 pt-1">
              <span>Estimasi gaji bersih</span>
              <span className="font-bold text-gray-700">
                {rupiah(gajiPokok - totalPotongan)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
