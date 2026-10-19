"use client";
import { useEffect, useState } from "react";

// Tombol kecil "Lihat gambar" di baris item; ketuk -> pop up foto (geser dengan panah
// atau ketuk gambar berikutnya). Esc / ketuk latar / × untuk menutup.
export default function FotoItem({ nama, foto }) {
  const [buka, setBuka] = useState(false);
  const [n, setN] = useState(0);
  const jml = foto.length;

  useEffect(() => {
    if (!buka) return;
    const tombol = (e) => {
      if (e.key === "Escape") setBuka(false);
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
  }, [buka, jml]);

  if (!jml) return null;
  return (
    <>
      <button type="button" className="fbtn" aria-label={`Lihat foto ${nama}`} onClick={() => { setN(0); setBuka(true); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5-8 9" />
        </svg>
        <span>Lihat gambar{jml > 1 ? ` (${jml})` : ""}</span>
      </button>
      {buka && (
        <div className="fmodal" role="dialog" aria-modal="true" aria-label={`Foto ${nama}`} onClick={() => setBuka(false)}>
          <div className="fbox" onClick={(e) => e.stopPropagation()}>
            <div className="fhead">
              <b>{nama}</b>
              <button type="button" aria-label="Tutup" onClick={() => setBuka(false)}>×</button>
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
        </div>
      )}
    </>
  );
}
