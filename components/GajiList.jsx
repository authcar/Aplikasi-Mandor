"use client";
import { useState } from "react";
import { rupiah } from "@/lib/format";

// Daftar proyek dengan dropdown rincian gaji. Dipakai di sisi supervisor & mandor.
export default function GajiList({ rekap }) {
  const [open, setOpen] = useState({});
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  if (rekap.length === 0)
    return <p className="text-sm text-gray-400">Belum ada proyek aktif.</p>;

  return (
    <div className="space-y-3">
      {rekap.map((r) => (
        <div key={r.id} className="card overflow-hidden">
          <button
            onClick={() => toggle(r.id)}
            className="flex w-full items-center justify-between p-4 text-left active:bg-gray-50"
          >
            <div>
              <p className="font-bold">{r.nama}</p>
              <p className="text-sm text-gray-500">{r.lokasi}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-lg font-bold text-gray-900">{rupiah(r.total)}</p>
              <span
                className={`text-xl text-gray-300 transition-transform ${
                  open[r.id] ? "rotate-90" : ""
                }`}
              >
                ›
              </span>
            </div>
          </button>

          {open[r.id] && (
            <div className="space-y-2.5 border-t border-gray-100 bg-gray-50/60 px-4 pb-4 pt-3">
              <Baris label="Upah tukang" val={r.upah} plus />
              <Baris label="Lembur" val={r.lembur} plus />
              <Baris label="Reimburse" val={r.reimburse} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Baris({ label, val, plus }) {
  const cls = plus ? "text-green-600" : "text-gray-900";
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={`font-bold ${cls}`}>
        {plus ? "+ " : ""}
        {rupiah(val)}
      </span>
    </div>
  );
}
