"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Gambar mini item (foto pertama) di baris item; ketuk -> pop up foto besar
// (geser dengan panah / ketuk gambar). Esc / ketuk latar / × untuk menutup.
// Dipakai di dalam baris yang bisa diketuk (kartu akordeon), jadi semua ketukan
// di sini tidak diteruskan ke baris itu.
const berhenti = (e) => e.stopPropagation();

// Pop up foto besar. `mulai` = indeks foto yang dibuka, `tutup` dipanggil saat ditutup.
export function Pratinjau({ nama, foto, mulai = 0, tutup }) {
  const [n, setN] = useState(mulai);
  const jml = foto.length;

  useEffect(() => {
    const tombol = (e) => {
      if (e.key === "Escape") tutup();
      else if (e.key === "ArrowRight") setN((x) => (x + 1) % jml);
      else if (e.key === "ArrowLeft") setN((x) => (x + jml - 1) % jml);
    };
    const tahan = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", tombol);
    return () => {
      document.body.style.overflow = tahan;
      window.removeEventListener("keydown", tombol);
    };
  }, [jml, tutup]);

  return createPortal(
    <div className="fmodal" role="dialog" aria-modal="true" aria-label={`Foto ${nama}`} onClick={(e) => { berhenti(e); tutup(); }}>
      <div className="fbox" onClick={berhenti}>
        <div className="fhead">
          <b>{nama}</b>
          <button type="button" aria-label="Tutup" onClick={tutup}>×</button>
        </div>
        <img src={foto[n]} alt={`${nama} (${n + 1}/${jml})`} onClick={() => jml > 1 && setN((n + 1) % jml)} />
        {jml > 1 && (
          <div className="fnav">
            <button type="button" aria-label="Foto sebelumnya" onClick={() => setN((n + jml - 1) % jml)}>‹</button>
            <span>{n + 1} / {jml}</span>
            <button type="button" aria-label="Foto berikutnya" onClick={() => setN((n + 1) % jml)}>›</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function FotoItem({ nama, foto }) {
  const [buka, setBuka] = useState(false);
  const jml = foto.length;
  const tutup = useCallback(() => setBuka(false), []);
  if (!jml) return null;
  return (
    <>
      <button type="button" className="fthumb" aria-label={`Perbesar foto ${nama}${jml > 1 ? ` (${jml} foto)` : ""}`}
        onClick={(e) => { berhenti(e); setBuka(true); }} onKeyDown={berhenti}>
        <img src={foto[0]} alt="" loading="lazy" />
        {jml > 1 && <span className="fcount">{jml}</span>}
      </button>
      {buka && <Pratinjau nama={nama} foto={foto} tutup={tutup} />}
    </>
  );
}
