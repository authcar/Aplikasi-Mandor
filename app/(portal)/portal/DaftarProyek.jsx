"use client";
import { useState } from "react";
import Link from "next/link";

const cocok = (k, q) => !q || [k.nama, k.kode, k.klien, k.lokasi].some((x) => (x || "").toLowerCase().includes(q));

function Kartu({ k }) {
  return (
    <Link href={`/portal/proyek/${k.id}`} className="proj">
      <div className="row" style={{ alignItems: "center" }}>
        <span className="small" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[k.kode, k.klien].filter(Boolean).join(" · ") || "—"}</span>
        <span className="row" style={{ gap: 6, flex: "none" }}>
          {k.defect > 0 && <span className="badge b-bad">{k.defect} defect baru</span>}
          <span className={`badge ${k.aktif ? k.kelas : "b-n"}`}>{k.aktif ? k.status : "Arsip"}</span>
        </span>
      </div>
      <h3>{k.nama}</h3>
      <div className="small" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        {k.n} item{k.deadline ? ` · Deadline ${k.deadline}` : ""}
        {k.sisa && <span className={`badge ${k.sisa[1]}`}>{k.sisa[0]}</span>}
      </div>
      <div className="row" style={{ alignItems: "center" }}>
        <div className="bar" style={{ flex: 1 }}><i style={{ width: `${k.persen}%` }} /></div>
        <b className="num">{k.persenTeks}</b>
      </div>
    </Link>
  );
}

const ikon = (d) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const IKON_CARI = ikon(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
const IKON_ARSIP = ikon(<><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M10 13h4" /></>);

// Judul halaman, tombol cari & arsip, lalu daftar proyek. `children` (form
// proyek baru) tampil di antara judul dan daftar. Kolom cari dan proyek arsip
// tersembunyi sampai tombolnya diketuk.
export default function DaftarProyek({ kartu, kosong, label, tautan, children }) {
  const [cari, setCari] = useState("");
  const [bukaCari, setBukaCari] = useState(false);
  const [bukaArsip, setBukaArsip] = useState(false);
  const q = cari.trim().toLowerCase();
  const tampil = kartu.filter((k) => cocok(k, q));
  const aktif = tampil.filter((k) => k.aktif);
  const arsip = tampil.filter((k) => !k.aktif);
  const nArsip = kartu.filter((k) => !k.aktif).length;

  return (
    <>
      <div className="row" style={{ alignItems: "center" }}>
        <div>
          <div className="eb">{label}</div>
          <h1>Proyek</h1>
        </div>
        <div className="acts" style={{ flex: "none" }}>
          {kartu.length > 0 && (
            <button type="button" className="act" aria-label="Cari proyek" aria-pressed={bukaCari}
              style={{ width: 48, padding: 0, ...(bukaCari && { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" }) }}
              onClick={() => { setBukaCari((b) => !b); if (bukaCari) setCari(""); }}>
              {IKON_CARI}
            </button>
          )}
          {nArsip > 0 && (
            <button type="button" className="act" aria-label={`Proyek arsip (${nArsip})`} aria-pressed={bukaArsip}
              style={{ minWidth: 48, padding: "0 10px", gap: 6, ...(bukaArsip && { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" }) }}
              onClick={() => setBukaArsip((b) => !b)}>
              {IKON_ARSIP}<span>{nArsip}</span>
            </button>
          )}
          {tautan}
        </div>
      </div>

      {children}

      {bukaCari && (
        <input className="inp" type="search" autoFocus value={cari} onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama proyek, kode, atau klien…" aria-label="Cari proyek" />
      )}
      {!kartu.length && <div className="card small">{kosong}</div>}
      {kartu.length > 0 && !tampil.length && <div className="card small">Tidak ada proyek yang cocok dengan “{cari.trim()}”.</div>}
      {aktif.map((k) => <Kartu key={k.id} k={k} />)}
      {(bukaArsip || (bukaCari && q)) && arsip.length > 0 && (
        <>
          <div className="fl" style={{ margin: "8px 0 0" }}>Proyek arsip ({arsip.length})</div>
          {arsip.map((k) => <Kartu key={k.id} k={k} />)}
        </>
      )}
    </>
  );
}
