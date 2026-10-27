"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAksi } from "./useAksi";
import Pesan from "./Pesan";
import { hapusBanyakProyek } from "./aksi";

const cocok = (k, q) => !q || [k.nama, k.kode, k.klien, k.lokasi].some((x) => (x || "").toLowerCase().includes(q));
const ARSIP = "__arsip";

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
      <div>
        <h3>{k.nama}</h3>
        {k.lokasi && <div className="small lok">{k.lokasi}</div>}
      </div>
      <div className="bar"><i style={{ width: `${k.persen}%` }} /></div>
      {k.aktif && k.n > 0 && k.persen < 99.995 && !k.adaProgres && <div className="small" style={{ marginTop: -2, color: "var(--bad)", fontWeight: 700 }}>Tidak ada progress minggu ini</div>}
      {k.n > 0 && k.terakhir && <div className="small" style={{ marginTop: -2 }}>Terakhir update {k.terakhir}{k.oleh ? ` · oleh ${k.oleh}` : ""}</div>}
      <div className="kpi">
        <div><b className="num">{k.persenTeks}</b><span>Progres</span></div>
        <div><b className="num">{k.n}</b><span>Item</span></div>
        <div>
          <b className="num" style={k.sisa || !k.aktif ? undefined : { color: "var(--bad)" }}>{k.sisa ? k.sisa[0] : "—"}</b>
          <span style={k.deadline ? undefined : { color: "var(--bad)", fontWeight: 700 }}>{k.deadline ? `Deadline ${k.deadline}` : "Perlu input deadline"}</span>
        </div>
      </div>
    </Pembungkus>
  );
}

const ikon = (d) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const IKON_CARI = ikon(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
const IKON_HAPUS = ikon(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />);
const IKON_RESET = ikon(<><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>);
const IKON_LIST = ikon(<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />);
const IKON_GRID = ikon(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>);

// Judul halaman dan tombol bobot / hapus, bar cari + filter status + tampilan
// daftar / grid, lalu kartu proyek. `children` (form proyek baru) tampil di
// antara judul dan daftar. Proyek arsip dipilih lewat filter status.
export default function DaftarProyek({ kartu, kosong, label, tautan, admin, children }) {
  const aksi = useAksi();
  const [hapusMode, setHapusMode] = useState(false);
  const [dipilih, setDipilih] = useState([]); // id proyek
  const [konfirm, setKonfirm] = useState(false);
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState(""); // "" = semua yang aktif
  const [tampilan, setTampilan] = useState("grid"); // bawaan: kartu
  useEffect(() => {
    try { if (localStorage.getItem("portal.tampilan") === "daftar") setTampilan("daftar"); } catch {}
  }, []);
  const ubahTampilan = (t) => {
    setTampilan(t);
    try { localStorage.setItem("portal.tampilan", t); } catch {}
  };
  const q = cari.trim().toLowerCase();
  const tampil = kartu.filter((k) => cocok(k, q));
  const nArsip = kartu.filter((k) => !k.aktif).length;
  const bukaArsip = status === ARSIP;
  const statusAda = [...new Set(kartu.filter((k) => k.aktif).map((k) => k.status))];
  const daftar = bukaArsip ? tampil.filter((k) => !k.aktif) : tampil.filter((k) => k.aktif && (!status || k.status === status));
  const daftarId = daftar.map((k) => k.id);
  const toggle = (id) => setDipilih((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const kartuProps = (k) => ({ k, pilih: hapusMode, dipilih: dipilih.includes(k.id), onToggle: () => toggle(k.id) });
  const adaFilter = !!q || !!status;

  return (
    <>
      <div className="row" style={{ alignItems: "center" }}>
        <div>
          <div className="eb">{label}</div>
          <h1>Proyek</h1>
        </div>
        <div className="acts" style={{ flex: "none" }}>
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

      {kartu.length > 0 && (
        <div className="toolbar">
          <label className="cari">
            {IKON_CARI}
            <input className="inp" type="search" value={cari} onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama, kode, atau klien" aria-label="Cari proyek" />
          </label>
          <select className="inp" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status">
            <option value="">Semua status</option>
            {statusAda.map((s) => <option key={s} value={s}>{s}</option>)}
            {nArsip > 0 && <option value={ARSIP}>Arsip ({nArsip})</option>}
          </select>
          <button type="button" className="act reset" disabled={!adaFilter} onClick={() => { setCari(""); setStatus(""); }}>
            {IKON_RESET}Reset filter
          </button>
          <div className="seg tampilan" role="group" aria-label="Tampilan">
            <button type="button" aria-label="Tampilan grid" aria-pressed={tampilan === "grid"} onClick={() => ubahTampilan("grid")}>{IKON_GRID}</button>
            <button type="button" aria-label="Tampilan daftar" aria-pressed={tampilan === "daftar"} onClick={() => ubahTampilan("daftar")}>{IKON_LIST}</button>
          </div>
        </div>
      )}

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

      {!kartu.length && <div className="card small">{kosong}</div>}
      {kartu.length > 0 && !daftar.length && (
        <div className="card small">
          {adaFilter ? "Tidak ada proyek yang cocok dengan filter. Ketuk Reset filter untuk melihat semua." : "Tidak ada proyek aktif. Pilih Arsip di filter status untuk melihat proyek yang diarsipkan."}
        </div>
      )}
      <div className={`daftar-proyek ${tampilan}`}>
        {daftar.map((k) => <Kartu key={k.id} {...kartuProps(k)} />)}
      </div>
    </>
  );
}
