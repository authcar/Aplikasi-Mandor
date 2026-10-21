"use client";
import { useMemo, useState } from "react";
import { hariIni, tgl, tglTh, rp, pct } from "@/lib/portal/format";
import { indeksRiwayat, daftarMinggu, hitungMinggu } from "@/lib/portal/mingguan";

// Warna irisan donut: tema kayu Taraco, dibuat cukup berbeda satu sama lain.
const WARNA = ["#8B5E3C", "#C29B6C", "#3E2C20", "#4F6B3A", "#9A5B12", "#5B7C99", "#A3402F", "#A99B88"];
const MAKS_IRISAN = 7; // sisanya digabung jadi "Lainnya"

const naik = (n) => `${n > 0 ? "+" : ""}${pct(n)}`;
const rentang = (m) => `${tgl(m.mulai)} – ${tglTh(m.akhir)}`;
const labelMinggu = (m) => `Minggu ${m.no} · ${rentang(m)}${m.berjalan ? " (berjalan)" : ""}`;

// Irisan donut: tahap terbesar dulu, yang kecil digabung.
function irisan(tahap) {
  const atas = tahap.slice(0, MAKS_IRISAN);
  const sisa = tahap.slice(MAKS_IRISAN);
  if (sisa.length) atas.push({ label: "Lainnya", poin: sisa.reduce((a, t) => a + t.poin, 0), bagian: sisa.reduce((a, t) => a + t.bagian, 0) });
  return atas.map((t, n) => ({ ...t, warna: WARNA[n % WARNA.length] }));
}

function Donut({ bagian, tengah }) {
  let dari = 0;
  const potong = bagian.map((b) => {
    const s = `${b.warna} ${dari}% ${dari + b.bagian}%`;
    dari += b.bagian;
    return s;
  });
  return (
    <div className="donut" role="img" style={{ background: `conic-gradient(${potong.join(", ")})` }}
      aria-label={`Tahap yang dikerjakan: ${bagian.map((b) => `${b.label} ${pct(b.bagian)}`).join(", ")}`}>
      <div className="donut-isi">{tengah}</div>
    </div>
  );
}

// Satu proyek per minggu. tampil="laporan" (supervisor): progres sebelum/sesudah per
// 7 hari dan tahap yang dikerjakan (donut). tampil="upah" (admin dan tukang):
// upah jasa tukang per tim; supervisor tidak menerima nilai rupiah dari server.
export default function Mingguan({ proyek, items, riwayat, tampil = "laporan", lihatTim }) {
  const upah = tampil === "upah";
  const hari = hariIni();
  const idx = useMemo(() => indeksRiwayat(riwayat), [riwayat]);
  const minggu = useMemo(() => daftarMinggu(proyek, items, riwayat, hari), [proyek, items, riwayat, hari]);
  const [no, setNo] = useState(minggu[minggu.length - 1].no);
  const m = minggu.find((x) => x.no === no) || minggu[minggu.length - 1];
  const h = useMemo(() => hitungMinggu(items, idx, m, hari), [items, idx, m, hari]);
  // Ringkasan semua minggu (daftar riwayat di bawah), terbaru di atas.
  const semua = useMemo(
    () => minggu.map((x) => ({ x, h: hitungMinggu(items, idx, x, hari) })).reverse(),
    [minggu, items, idx, hari]
  );
  const bagian = irisan(h.tahap);
  const totalUpah = h.tim.reduce((a, t) => a + t.upah, 0);

  return (
    <>
      <label className="lbl">Minggu
        <select className="inp" value={m.no} onChange={(e) => setNo(Number(e.target.value))}>
          {[...minggu].reverse().map((x) => <option key={x.no} value={x.no}>{labelMinggu(x)}</option>)}
        </select>
      </label>

      {!upah && (
        <>
      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ alignItems: "center" }}>
          <h3>Progres minggu ini</h3>
          <span className={`badge ${h.naik > 0.005 ? "b-ok" : h.naik < -0.005 ? "b-bad" : "b-n"}`}>{naik(h.naik)}</span>
        </div>
        <div className="row small">
          <span>Sebelum <b className="num">{pct(h.sebelum)}</b></span>
          <span>Sesudah <b className="num">{pct(h.sesudah)}</b></span>
        </div>
        {/* Bagian gelap = progres di awal minggu, bagian terang = tambahan minggu ini. */}
        <div className="bar2" role="img" aria-label={`Progres dari ${pct(h.sebelum)} menjadi ${pct(h.sesudah)}`}>
          <i style={{ width: `${Math.min(h.sebelum, h.sesudah)}%` }} />
          <b style={{ width: `${Math.abs(h.naik)}%`, background: h.naik < 0 ? "var(--bad)" : "var(--ok)" }} />
        </div>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <h3>Tahap yang dikerjakan</h3>
        {bagian.length ? (
          <div className="donut-wrap">
            <Donut bagian={bagian} tengah={<><b className="num">{naik(h.naik)}</b><span>poin</span></>} />
            <ul className="legenda">
              {bagian.map((b) => (
                <li key={b.label}>
                  <i style={{ background: b.warna }} aria-hidden="true" />
                  <span className="nm">{b.label}</span>
                  <span className="num">{pct(b.bagian)}</span>
                  <span className="num small">+{pct(b.poin)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="small" style={{ margin: 0 }}>Belum ada tahap yang dikerjakan di minggu ini.</p>
        )}
      </div>

        </>
      )}

      {upah && (
        <div className="card stack" style={{ gap: 12 }}>
          <div className="row" style={{ alignItems: "center" }}>
            <h3>Per tim</h3>
            {h.tim.length > 1 && <b className="num">{rp(totalUpah)}</b>}
          </div>
          <p className="small" style={{ margin: 0 }}>
            Upah = kenaikan % progres minggu ini × jasa tukang tiap item.
          </p>
          {h.tim.length === 0 && <p className="small" style={{ margin: 0 }}>Belum ada item.</p>}
          {h.tim.map((t) => <KartuTim key={t.tim} t={t} />)}
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <h3 style={{ marginTop: 6 }}>{upah ? "Upah tiap minggu" : "Riwayat mingguan"}</h3>
        <div className="card" style={{ padding: "4px 14px" }}>
          {semua.map(({ x, h: r }) => (
            <button key={x.no} type="button" className={`baris-minggu${x.no === m.no ? " aktif" : ""}`} onClick={() => setNo(x.no)}>
              <span className="t">
                <span className="nm">Minggu {x.no}{x.berjalan ? " · berjalan" : ""}</span>
                <span className="small">{rentang(x)}</span>
              </span>
              {upah ? (
                <b className="num">{rp(r.tim.reduce((a, t) => a + t.upah, 0))}</b>
              ) : (
                <>
                  <span className="num small">{pct(r.sebelum)} → {pct(r.sesudah)}</span>
                  <b className={`num ${r.naik > 0.005 ? "delta" : ""}`}>{naik(r.naik)}</b>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// Upah satu tim di minggu terpilih; ketuk untuk melihat per item yang berubah.
function KartuTim({ t }) {
  const berubah = t.item.filter((i) => Math.abs(i.naik) > 0.005);
  return (
    <details className="lipat">
      <summary>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="row">
            <b className="nm">{t.tim}</b>
            <b className="num">{rp(t.upah)}</b>
          </span>
          <span className="small">
            {berubah.length ? `${berubah.length === t.item.length ? "Semua" : `${berubah.length} dari ${t.item.length}`} item ada progres` : "Tidak ada progres"}
            {t.total > 0 && ` · terkumpul ${rp(t.kumulatif)} / ${rp(t.total)}`}
          </span>
        </span>
      </summary>
      <div className="lipat-b">
        {berubah.length === 0 && <p className="small" style={{ margin: 0 }}>Belum ada kenaikan progres.</p>}
        {berubah.map((i) => (
          <div key={i.id} className="baris">
            <span className="t">
              <span className="nm">{i.nama}</span>
              <span className="small">{i.area} · {pct(i.sebelum)} → {pct(i.sesudah)} ({naik(i.naik)}){i.harga ? ` × ${rp(i.harga)}` : " · jasa belum diisi"}</span>
            </span>
            <span className="num" style={{ color: i.upah < 0 ? "var(--bad)" : undefined }}>{rp(i.upah)}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
