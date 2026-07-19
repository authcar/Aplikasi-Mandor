"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import { laporanTeks, totalOrangTim, tglLaporanID } from "@/lib/format";

// Card riwayat laporan absensi harian, bisa di-dropdown.
// riwayat: [{ tanggal: "2026-07-08", tims: [{ nama, lines: [{jumlah, kegiatan}] }] }]
export default function RiwayatLaporanCard({ riwayat = [], defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(null);
  const [salinAt, setSalinAt] = useState(null);

  const toggleHari = (tanggal) =>
    setExpanded((cur) => (cur === tanggal ? null : tanggal));

  const salin = async (tanggal, tims) => {
    await navigator.clipboard.writeText(laporanTeks(tanggal, tims));
    setSalinAt(tanggal);
    setTimeout(() => setSalinAt((cur) => (cur === tanggal ? null : cur)), 2000);
  };

  return (
    <div className="card mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="font-bold text-gray-700 text-sm">Riwayat Laporan</span>
        <span className="flex items-center gap-2 text-gray-400">
          {riwayat.length > 0 && (
            <span className="text-xs font-medium">{riwayat.length} hari</span>
          )}
          <Icon
            name="chevron-down"
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {riwayat.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-400">
              Belum ada riwayat laporan.
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {riwayat.map((h) => {
                const isOpen = expanded === h.tanggal;
                return (
                  <div key={h.tanggal}>
                    <button
                      type="button"
                      onClick={() => toggleHari(h.tanggal)}
                      className="flex w-full items-center justify-between px-4 py-2.5"
                    >
                      <span className="text-sm font-semibold capitalize text-gray-600">
                        {tglLaporanID(h.tanggal)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {totalOrangTim(h.tims)} orang
                        </span>
                        <Icon
                          name="chevron-down"
                          className={`h-3.5 w-3.5 text-gray-300 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3">
                        <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-sans text-xs text-gray-600">
                          {laporanTeks(h.tanggal, h.tims)}
                        </pre>
                        <button
                          type="button"
                          onClick={() => salin(h.tanggal, h.tims)}
                          className="mt-2 text-xs font-semibold text-brand active:opacity-70"
                        >
                          {salinAt === h.tanggal ? "Tersalin ✓" : "Salin Laporan"}
                        </button>
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
