"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAksi } from "../useAksi";
import Pesan from "../Pesan";
import { FASE, JENIS, JENIS_LABEL, TAHAP } from "@/lib/portal/progresBoq";
import { angka } from "@/lib/portal/format";
import { simpanBobotTahap, resetBobotTahap } from "../aksi";

// tersimpan = { [jenis]: { [tahap]: persen } } (hanya jenis yang pernah diubah).
export default function BobotTahap({ tersimpan }) {
  const aksi = useAksi();
  return (
    <main className="wrap">
      <Link href="/portal" className="back">← Semua proyek</Link>
      <div>
        <div className="eb">Admin</div>
        <h1>Bobot tahap</h1>
      </div>
      <p className="small" style={{ margin: 0 }}>
        Persen tiap tahap pekerjaan menentukan berapa progres item bertambah saat tahap itu dicentang. Total tiap jenis
        harus 100%. Pengaturan ini berlaku untuk <b>semua proyek</b>: begitu disimpan, angka progres proyek yang sedang
        berjalan ikut berubah, termasuk yang dilihat klien.
      </p>
      {JENIS.map((j) => <KartuJenis key={j} jenis={j} tersimpan={tersimpan[j]} aksi={aksi} />)}
      <Pesan aksi={aksi} />
    </main>
  );
}

function KartuJenis({ jenis, tersimpan, aksi }) {
  const berlaku = (s) => Number(tersimpan?.[s.k] ?? s.w);
  const awal = () => Object.fromEntries(TAHAP[jenis].map((s) => [s.k, String(berlaku(s)).replace(".", ",")]));
  const [isi, setIsi] = useState(awal);
  // Setelah simpan / kembali ke bawaan, samakan lagi dengan data server.
  useEffect(() => setIsi(awal()), [JSON.stringify(tersimpan)]); // eslint-disable-line react-hooks/exhaustive-deps

  const nilai = (k) => angka(isi[k]) ?? NaN;
  const total = Math.round(TAHAP[jenis].reduce((a, s) => a + (nilai(s.k) || 0), 0) * 100) / 100;
  const valid = TAHAP[jenis].every((s) => nilai(s.k) >= 0 && nilai(s.k) <= 100) && total === 100;
  const berubah = TAHAP[jenis].some((s) => nilai(s.k) !== berlaku(s));
  const label = JENIS_LABEL[jenis];

  return (
    <form className="card stack" onSubmit={(e) => {
      e.preventDefault();
      aksi.jalankan(
        () => simpanBobotTahap(jenis, Object.fromEntries(TAHAP[jenis].map((s) => [s.k, nilai(s.k)]))),
        `Bobot tahap ${label} disimpan.`
      );
    }}>
      <div className="row" style={{ alignItems: "center" }}>
        <h3>{label}</h3>
        <span className={`badge ${tersimpan ? "b-warn" : "b-n"}`}>{tersimpan ? "Diubah" : "Bawaan"}</span>
      </div>
      {FASE.map((f) => {
        const st = TAHAP[jenis].filter((s) => s.fase === f.k);
        if (!st.length) return null;
        return (
          <div key={f.k}>
            <div className="fl">{f.label}</div>
            <div className="stack" style={{ gap: 8 }}>
              {st.map((s) => (
                <label key={s.k} className="tglrow">
                  <span>{s.label}{tersimpan && berlaku(s) !== s.w ? ` (bawaan ${s.w}%)` : ""}</span>
                  <input className="inp num" inputMode="decimal" aria-label={`${s.label} (%)`}
                    style={{ flex: "0 0 96px", textAlign: "right" }}
                    value={isi[s.k]} onChange={(e) => setIsi({ ...isi, [s.k]: e.target.value })} />
                </label>
              ))}
            </div>
          </div>
        );
      })}
      <div className="row" style={{ alignItems: "center" }}>
        <b>Total</b>
        <span className={`badge ${total === 100 ? "b-ok" : "b-bad"}`}>
          {total.toLocaleString("id-ID")}%{total === 100 ? "" : total < 100 ? ` · kurang ${(100 - total).toLocaleString("id-ID")}%` : ` · lebih ${(total - 100).toLocaleString("id-ID")}%`}
        </span>
      </div>
      <div className="acts">
        <button className="btn" disabled={aksi.sibuk || !valid || !berubah}>Simpan</button>
        {tersimpan && (
          <button type="button" className="act" disabled={aksi.sibuk}
            onClick={() => confirm(`Kembalikan bobot tahap ${label} ke bawaan?`) && aksi.jalankan(() => resetBobotTahap(jenis), `Bobot tahap ${label} kembali ke bawaan.`)}>
            Kembali ke bawaan
          </button>
        )}
      </div>
    </form>
  );
}
