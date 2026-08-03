"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { rupiah } from "@/lib/format";

// Riwayat rekap gaji bulanan (Supervisor) — bagian "Rekap Gaji" di atas
// cuma real-time (minggu ini / bulan berjalan), jadi ini nampilin rollup
// bulan-bulan sebelumnya: biaya per proyek (upah+lembur+reimburse) dan
// potongan (hari tanpa laporan + kasbon disetujui).
// riwayat: [{ key, label, proyekRincian: [{proyekId, nama, upah, lembur,
//   reimburse, total}], totalBiaya, hariTanpaLapor, potonganPersen, kasbon,
//   totalPotongan }]
export default function RiwayatGajiBulanan({ riwayat = [], defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(null);

  const toggleBulan = (key) => setExpanded((cur) => (cur === key ? null : key));

  return (
    <div className="card mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-bold text-gray-700">Riwayat Gaji</span>
        <span className="flex items-center gap-2 text-gray-400">
          {riwayat.length > 0 && (
            <span className="text-xs font-medium">{riwayat.length} bulan</span>
          )}
          <Icon name="chevron-down" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {riwayat.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-400">
              Belum ada riwayat gaji bulan sebelumnya.
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {riwayat.map((b) => {
                const isOpen = expanded === b.key;
                return (
                  <div key={b.key}>
                    <button
                      type="button"
                      onClick={() => toggleBulan(b.key)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2.5"
                    >
                      <span className="text-sm font-semibold text-gray-600">{b.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {rupiah(b.totalBiaya)}
                        </span>
                        {b.totalPotongan > 0 && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                            −{rupiah(b.totalPotongan)}
                          </span>
                        )}
                        <Icon
                          name="chevron-down"
                          className={`h-3.5 w-3.5 text-gray-300 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="space-y-3 px-4 pb-3">
                        {b.proyekRincian.length > 0 ? (
                          <div className="space-y-1.5">
                            {b.proyekRincian.map((p) => (
                              <div key={p.proyekId} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                                <span className="truncate font-medium text-gray-700">{p.nama}</span>
                                <span className="shrink-0 font-semibold text-emerald-700">{rupiah(p.total)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">Tidak ada biaya proyek bulan ini.</p>
                        )}

                        {b.totalPotongan > 0 && (
                          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                            {b.hariTanpaLapor > 0 && (
                              <p>
                                {b.hariTanpaLapor} hari tanpa laporan harian (−{b.potonganPersen}%)
                              </p>
                            )}
                            {b.kasbon > 0 && <p>Kasbon disetujui: −{rupiah(b.kasbon)}</p>}
                            <p className="mt-1 font-bold">Total potongan: −{rupiah(b.totalPotongan)}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
