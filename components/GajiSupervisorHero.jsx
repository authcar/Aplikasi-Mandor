"use client";
import { useState } from "react";
import { rupiah } from "@/lib/format";
import Icon from "@/components/Icon";

export default function GajiSupervisorHero({ gajiPokok = 0, potongan = [], kasbon = 0, label = "Gaji Supervisor" }) {
  const [visible, setVisible] = useState(false);

  const bulanIni = new Date().toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const totalPersen = potongan.reduce((s, r) => s + Number(r.persentase), 0);
  const nominalPotongan = gajiPokok * (totalPersen / 100);
  const gajiBersih = gajiPokok - nominalPotongan - kasbon;

  return (
    <div className="hero mb-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-white/80">{label} · {bulanIni}</p>
        <button
          onClick={() => setVisible((v) => !v)}
          className="text-white/70 active:text-white/50"
          aria-label={visible ? "Sembunyikan nominal" : "Tampilkan nominal"}
        >
          <Icon name={visible ? "eye-off" : "eye"} className="h-5 w-5" />
        </button>
      </div>

      {visible ? (
        <>
          <p className="text-3xl font-bold tracking-tight">
            {rupiah(gajiBersih)}
          </p>
          {(totalPersen > 0 || kasbon > 0) && (
            <div className="mt-2 space-y-0.5 text-sm text-white/70">
              <div className="flex justify-between">
                <span>Gaji pokok</span>
                <span>{rupiah(gajiPokok)}</span>
              </div>
              {totalPersen > 0 && (
                <div className="flex justify-between text-red-200">
                  <span>Potongan absensi ({totalPersen}%)</span>
                  <span>−{rupiah(nominalPotongan)}</span>
                </div>
              )}
              {kasbon > 0 && (
                <div className="flex justify-between text-red-200">
                  <span>Kasbon bulan ini</span>
                  <span>−{rupiah(kasbon)}</span>
                </div>
              )}
            </div>
          )}
          {totalPersen === 0 && kasbon === 0 && (
            <p className="text-sm text-white/70 mt-1">Tidak ada potongan bulan ini ✓</p>
          )}
        </>
      ) : (
        <p className="text-3xl font-bold tracking-tight">••••••</p>
      )}
    </div>
  );
}
