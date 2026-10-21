"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Lonceng di header staf: lencana jumlah pemberitahuan + panel bertab.
// `items` = [{ id, jenis, judul, sub, label, kelas, href }], jenis "deadline" | "defect".
const TAB = [["semua", "Semua"], ["deadline", "Deadline"], ["defect", "Defect"]];

export default function Lonceng({ items }) {
  const [buka, setBuka] = useState(false);
  const [tab, setTab] = useState("semua");
  const ref = useRef(null);
  const tabAda = TAB.filter(([k]) => k === "semua" || items.some((i) => i.jenis === k));
  const daftar = tab === "semua" ? items : items.filter((i) => i.jenis === tab);

  useEffect(() => {
    if (!buka) return;
    const luar = (e) => { if (!ref.current?.contains(e.target)) setBuka(false); };
    const esc = (e) => { if (e.key === "Escape") setBuka(false); };
    document.addEventListener("pointerdown", luar);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", luar); document.removeEventListener("keydown", esc); };
  }, [buka]);

  return (
    <div className="lonceng" ref={ref}>
      <button type="button" className="lonceng-btn" aria-label={`Pemberitahuan (${items.length})`} aria-expanded={buka}
        onClick={() => setBuka((b) => !b)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 0112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 004 0" />
        </svg>
        {items.length > 0 && <i className="lencana">{items.length}</i>}
      </button>
      {buka && (
        <div className="lonceng-panel" role="dialog" aria-label="Pemberitahuan">
          <div className="lonceng-tab" role="tablist">
            {tabAda.map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div className="lonceng-isi">
            {!daftar.length && <p className="small" style={{ margin: 0, padding: "18px 4px", textAlign: "center" }}>Belum ada pemberitahuan.</p>}
            {daftar.map((i) => (
              <Link key={i.id} href={i.href} className="lonceng-baris" onClick={() => setBuka(false)}>
                <span className="t">
                  <b>{i.judul}</b>
                  <span className="small">{i.sub}</span>
                </span>
                <span className={`badge ${i.kelas}`}>{i.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
