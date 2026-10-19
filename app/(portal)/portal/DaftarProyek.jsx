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

// Daftar proyek dengan kolom cari; proyek arsip dilipat di bawahnya.
export default function DaftarProyek({ kartu, kosong }) {
  const [cari, setCari] = useState("");
  const q = cari.trim().toLowerCase();
  const tampil = kartu.filter((k) => cocok(k, q));
  const aktif = tampil.filter((k) => k.aktif);
  const arsip = tampil.filter((k) => !k.aktif);

  return (
    <>
      {kartu.length > 0 && (
        <input className="inp" type="search" value={cari} onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama proyek, kode, atau klien…" aria-label="Cari proyek" />
      )}
      {!kartu.length && <div className="card small">{kosong}</div>}
      {kartu.length > 0 && !tampil.length && <div className="card small">Tidak ada proyek yang cocok dengan “{cari.trim()}”.</div>}
      {aktif.map((k) => <Kartu key={k.id} k={k} />)}
      {arsip.length > 0 && (
        <details className="lipat" open={!!q || undefined}>
          <summary><b>Proyek arsip</b><span className="num small">{arsip.length}</span></summary>
          <div className="lipat-b">{arsip.map((k) => <Kartu key={k.id} k={k} />)}</div>
        </details>
      )}
    </>
  );
}
