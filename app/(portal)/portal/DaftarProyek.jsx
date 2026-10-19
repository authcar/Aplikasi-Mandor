"use client";
import { useState } from "react";
import Link from "next/link";
import { useAksi } from "./useAksi";
import Pesan from "./Pesan";
import { hapusBanyakProyek } from "./aksi";

const cocok = (k, q) => !q || [k.nama, k.kode, k.klien, k.lokasi].some((x) => (x || "").toLowerCase().includes(q));

function Kartu({ k, pilih, dipilih, onToggle }) {
  const Pembungkus = pilih
    ? ({ children }) => (
        <div className="proj" role="checkbox" aria-checked={dipilih} tabIndex={0} onClick={onToggle}
          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggle(); } }}
          style={{ cursor: "pointer", ...(dipilih && { borderColor: "var(--bad)", boxShadow: "0 0 0 1px var(--bad)" }) }}>
          {children}

        </div>
      )
    : ({ children }) => <Link href={`/portal/proyek/${k.id}`} className="proj">{children}</Link>;
  return (
    <Pembungkus>
      {pilih && <input type="checkbox" checked={dipilih} readOnly tabIndex={-1} aria-hidden="true" style={{ width: 20, height: 20, accentColor: "var(--bad)", pointerEvents: "none" }} />}
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
    </Pembungkus>
  );
}

const ikon = (d) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const IKON_CARI = ikon(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
const IKON_HAPUS = ikon(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />);
const IKON_ARSIP = ikon(<><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M10 13h4" /></>);

// Judul halaman, tombol cari & arsip, lalu daftar proyek. `children` (form
// proyek baru) tampil di antara judul dan daftar. Kolom cari dan proyek arsip
// tersembunyi sampai tombolnya diketuk.
export default function DaftarProyek({ kartu, kosong, label, tautan, admin, children }) {
  const aksi = useAksi();
  const [hapusMode, setHapusMode] = useState(false);
  const [dipilih, setDipilih] = useState([]); // id proyek
  const [konfirm, setKonfirm] = useState(false);
  const [cari, setCari] = useState("");
  const [bukaCari, setBukaCari] = useState(false);
  const [bukaArsip, setBukaArsip] = useState(false);
  const q = cari.trim().toLowerCase();
  const tampil = kartu.filter((k) => cocok(k, q));
  const aktif = tampil.filter((k) => k.aktif);
  const arsip = tampil.filter((k) => !k.aktif);
  const nArsip = kartu.filter((k) => !k.aktif).length;
  const daftarId = (bukaArsip ? arsip : aktif).map((k) => k.id);
  const toggle = (id) => setDipilih((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const kartuProps = (k) => ({ k, pilih: hapusMode, dipilih: dipilih.includes(k.id), onToggle: () => toggle(k.id) });

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
          {admin && kartu.length > 0 && (
            <button type="button" className="act" aria-label="Pilih proyek untuk dihapus" aria-pressed={hapusMode}
              style={{ width: 48, padding: 0, ...(hapusMode && { background: "var(--bad)", color: "#fff", borderColor: "var(--bad)" }) }}
              onClick={() => { setHapusMode((b) => !b); setDipilih([]); setKonfirm(false); }}>
              {IKON_HAPUS}
            </button>
          )}
        </div>
      </div>

      {children}

      {hapusMode && (
        <div className="card" style={{ position: "sticky", bottom: 12, zIndex: 5, display: "flex", flexDirection: "column", gap: 10, borderColor: "var(--bad)" }}>
          {!konfirm ? (
            <>
              <div className="small">
                {dipilih.length ? <b>{dipilih.length} proyek dipilih</b> : "Ketuk kartu proyek untuk memilih yang akan dihapus."}
              </div>
              <div className="acts">
                <button type="button" className="act" onClick={() => setDipilih((d) => (d.length === daftarId.length ? [] : daftarId))}>
                  {dipilih.length === daftarId.length && daftarId.length ? "Batal pilih" : "Pilih semua"}
                </button>
                <button type="button" className="act" onClick={() => { setHapusMode(false); setDipilih([]); }}>Batal</button>
                <button type="button" className="act bahaya" disabled={!dipilih.length} onClick={() => setKonfirm(true)}>Hapus ({dipilih.length})</button>
              </div>
            </>
          ) : (
            <>
              <p className="note b-bad" style={{ margin: 0 }}>
                {dipilih.length} proyek dihapus permanen beserta item, progres, termin, foto, dan link kliennya (klien tidak bisa membuka link lagi). Tidak bisa dibatalkan:
                {" "}{kartu.filter((k) => dipilih.includes(k.id)).map((k) => k.nama).join(", ")}.
              </p>
              <div className="acts">
                <button type="button" className="act" onClick={() => setKonfirm(false)}>Kembali</button>
                <button type="button" className="act bahaya" disabled={aksi.sibuk}
                  onClick={async () => {
                    const ok = await aksi.jalankan(() => hapusBanyakProyek(dipilih), `${dipilih.length} proyek dihapus.`);
                    if (ok) { setHapusMode(false); setDipilih([]); setKonfirm(false); }
                  }}>
                  Hapus permanen
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <Pesan aksi={aksi} />

      {bukaCari && (
        <input className="inp" type="search" autoFocus value={cari} onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama proyek, kode, atau klien…" aria-label="Cari proyek" />
      )}
      {!kartu.length && <div className="card small">{kosong}</div>}
      {!bukaArsip && kartu.length > 0 && !aktif.length && <div className="card small">Tidak ada proyek yang cocok dengan “{cari.trim()}”.</div>}
      {bukaArsip ? (
        <>
          <div className="fl" style={{ margin: "8px 0 0" }}>Proyek arsip ({arsip.length})</div>
          {!arsip.length && <div className="card small">{q ? "Tidak ada proyek arsip yang cocok." : "Belum ada proyek arsip."}</div>}
          {arsip.map((k) => <Kartu key={k.id} {...kartuProps(k)} />)}
        </>
      ) : (
        aktif.map((k) => <Kartu key={k.id} {...kartuProps(k)} />)
      )}
    </>
  );
}
