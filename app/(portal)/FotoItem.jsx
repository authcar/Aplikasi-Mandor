"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Gambar mini item (foto pertama) di baris item; ketuk -> pop up foto besar
// (geser dengan panah / ketuk gambar). Esc / ketuk latar / × untuk menutup.
// Dipakai di dalam baris yang bisa diketuk (kartu akordeon), jadi semua ketukan
// di sini tidak diteruskan ke baris itu.
const berhenti = (e) => e.stopPropagation();

// Pop up foto besar. `mulai` = indeks foto yang dibuka, `tutup` dipanggil saat ditutup.
export function Pratinjau({ nama, foto, cap, mulai = 0, tutup }) {
  const [n, setN] = useState(mulai);
  const jml = foto.length;
  const lajur = useRef(null);
  // Pindah ke foto ke-i dengan menggulir lajur (geser jari di HP juga memakai lajur yang sama).
  const ke = useCallback((i) => {
    const el = lajur.current;
    if (el) el.scrollTo({ left: ((i % jml) + jml) % jml * el.clientWidth, behavior: "smooth" });
  }, [jml]);

  useEffect(() => {
    const el = lajur.current;
    if (el) el.scrollLeft = mulai * el.clientWidth;
  }, [mulai]);

  useEffect(() => {
    const tombol = (e) => {
      if (e.key === "Escape") tutup();
      else if (e.key === "ArrowRight") ke(n + 1);
      else if (e.key === "ArrowLeft") ke(n - 1);
    };
    const tahan = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", tombol);
    return () => {
      document.body.style.overflow = tahan;
      window.removeEventListener("keydown", tombol);
    };
  }, [n, ke, tutup]);

  return createPortal(
    <div className="fmodal" role="dialog" aria-modal="true" aria-label={`Foto ${nama}`} onClick={(e) => { berhenti(e); tutup(); }}>
      <div className="fbox" onClick={berhenti}>
        <div className="fhead">
          <b>{nama}</b>
          <button type="button" aria-label="Tutup" onClick={tutup}>×</button>
        </div>
        <div className="fgeser">
          <div className="flajur" ref={lajur} onScroll={(e) => setN(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
            {foto.map((u, i) => <img key={i} src={u} alt={`${nama} (${i + 1}/${jml})`} />)}
          </div>
          {jml > 1 && (
            <>
              <button type="button" className="fpanah kiri" aria-label="Foto sebelumnya" onClick={() => ke(n - 1)}>‹</button>
              <button type="button" className="fpanah kanan" aria-label="Foto berikutnya" onClick={() => ke(n + 1)}>›</button>
            </>
          )}
        </div>
        {cap && <div className="fcap">{cap[n]}</div>}
        {jml > 1 && <div className="fnav"><span>{n + 1} / {jml}</span></div>}
      </div>
    </div>,
    document.body
  );
}

export default function FotoItem({ nama, foto, cap }) {
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
      {buka && <Pratinjau nama={nama} foto={foto} cap={cap} tutup={tutup} />}
    </>
  );
}
