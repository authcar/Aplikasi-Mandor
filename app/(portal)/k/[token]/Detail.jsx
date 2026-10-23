"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { persenItem, persenProyek, areaProgres } from "@/lib/portal/progresBoq";
import {
  hariIni, tambahHari, tgl, tglTh, rp, pct, tagihanTermin, dibayarTermin, totalDibayar, statusProyek,
  JENIS_TERMIN, jenisTermin, nilaiTermin, totalNilai, labelDeadline, judulTermin, keteranganTermin,
  persenKlien, SPREAD_KLIEN, DEFECT_AKTIF,
} from "@/lib/portal/format";
import TabBar from "../../TabBar";
import Defect from "./Defect";
import FotoItem, { Pratinjau } from "../../FotoItem";

// Foto progres dari supervisor untuk satu item (terlama ke terbaru); ketuk untuk melihat besar dan menggeser.
function FotoProgresKlien({ nama, foto }) {
  const [buka, setBuka] = useState(false);
  if (!foto.length) return null;
  const tgl = (at) => new Date(at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" });
  return (
    <>
      <button type="button" className="act" style={{ minHeight: 32, padding: "0 12px", fontSize: ".75rem", whiteSpace: "nowrap" }} aria-label={`${foto.length} foto progres ${nama}`} onClick={() => setBuka(true)}>
        📷 {foto.length} foto
      </button>
      {buka && <Pratinjau nama={nama} foto={foto.map((f) => f.url)} cap={foto.map((f) => `Foto progres · ${tgl(f.at)}`)} mulai={foto.length - 1} tutup={() => setBuka(false)} />}
    </>
  );
}

function Ring({ p }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--sunk)" strokeWidth="9" />
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(c * p) / 100} ${c}`} transform="rotate(-90 42 42)" />
      <text x="42" y="47" textAnchor="middle" fontFamily="var(--fd)" fontWeight="700" fontSize="17" fill="var(--fg)">
        {Math.round(p)}%
      </text>
    </svg>
  );
}

// Ambil ulang data dari server tanpa reload (tab yang sedang dibuka tetap):
// saat halaman kembali dilihat (pindah tab/aplikasi, tab dipulihkan browser HP)
// dan tiap menit selama terbuka. Tanpa ini klien melihat data saat link dibuka.
const SEGARKAN_MS = 60_000;
function useSegarkan() {
  const router = useRouter();
  useEffect(() => {
    const segarkan = () => document.visibilityState === "visible" && router.refresh();
    const pulih = (e) => e.persisted && router.refresh();
    const id = setInterval(segarkan, SEGARKAN_MS);
    document.addEventListener("visibilitychange", segarkan);
    window.addEventListener("pageshow", pulih);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", segarkan);
      window.removeEventListener("pageshow", pulih);
    };
  }, [router]);
}

export default function Detail({ P }) {
  useSegarkan();
  const [tab, setTab] = useState("progres");
  const [bukaArea, setBukaArea] = useState(null); // satu area terbuka sekaligus
  const now = hariIni();
  const lalu = tambahHari(now, -7);
  const items = P.items.filter((i) => !i.hanya_jasa); // baris tanpa nomor hanya untuk Jasa tukang
  // Semua angka progres di halaman ini sudah termasuk persiapan & material
  // (persenKlien, lihat lib/portal/format.js); keterangannya tampil di bawah lingkaran.
  const p = persenKlien(persenProyek(items));
  const naik = p - persenKlien(persenProyek(items, lalu));
  const [st, cls] = statusProyek(P);
  const [sisa, kelasSisa] = P.deadline ? labelDeadline(P.deadline) : [];
  const areas = [...new Set(items.map((i) => i.area))];
  const nilaiT = nilaiTermin(P);
  const addon = P.addon || [];
  // Nilai proyek, Sisa, dan Sudah dibayar sudah termasuk addon (sama seperti tampilan admin).
  const totalAddon = addon.reduce((a, x) => a + x.nilai, 0);
  const total = totalNilai(nilaiT) + totalAddon;
  const dibayar = totalDibayar(P.termin, nilaiT) + addon.reduce((a, x) => a + (x.lunas_tgl ? x.nilai : 0), 0);

  return (
    <main className="wrap">
      <div>
        {P.klien && <div className="eb">Halo, {P.klien}</div>}
        <h1>{P.nama}</h1>
        {P.lokasi && <div className="small lok">{P.lokasi}</div>}
      </div>

      <section className="card ring">
        <Ring p={p} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <span className={`badge ${cls}`} style={{ alignSelf: "flex-start" }}>{st}</span>
          <div className="small">
            {naik > 0 ? <><span className="delta">+{pct(naik)}</span> progress dalam 7 hari terakhir</> : "Tidak ada perubahan 7 hari terakhir"}
          </div>
          {P.deadline && (
            <div className="small" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              Deadline {tglTh(P.deadline)} <span className={`badge ${kelasSisa}`}>{sisa}</span>
            </div>
          )}
        </div>
      </section>

      <TabBar
        tabs={[["progres", "Progres"], ["bayar", "Pembayaran"], ...(DEFECT_AKTIF ? [["defect", "Defect"]] : []), ["info", "Info"]]}
        value={tab}
        onChange={setTab}
      />

      <div key={tab} className="tab-isi">
      {tab === "progres" && (
        !items.length ? (
          <div className="card small">Rincian pekerjaan sedang disiapkan tim kami.</div>
        ) : (
          <>
            {/* Klien hanya melihat persentase per area dan per item; rincian fase/tahap cukup untuk staf. */}
            {areas.filter(areaProgres).map((a) => {
              const its = items.filter((i) => i.area === a);
              const pa = persenKlien(persenProyek(its));
              return (
                <details key={a} className="lipat" open={bukaArea === a}>
                  <summary onClick={(e) => { e.preventDefault(); setBukaArea(bukaArea === a ? null : a); }}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="row">
                        <h2>{a}</h2>
                        <span className="num small" style={{ margin: 0, whiteSpace: "nowrap" }}>{pct(pa)} · {its.length} item</span>
                      </span>
                      <span className="bar" style={{ display: "block", marginTop: 8 }}><i style={{ width: `${pa}%` }} /></span>
                    </span>
                  </summary>
                  <div className="lipat-b">
                  {its.map((it) => {
                    const v = persenKlien(persenItem(it));
                    return (
                      <div key={it.id} className="item mini">
                        <div className="row">
                          <div style={{ minWidth: 0 }}>
                            {it.kode && <div className="small num">{it.kode}</div>}
                            <h3>{it.nama}</h3>
                          </div>
                          <span style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
                            <FotoProgresKlien nama={it.nama} foto={it.foto_progres || []} />
                            <FotoItem nama={it.nama} foto={it.foto || []} />
                            <b className="num">{v}%</b>
                          </span>
                        </div>
                        <span className="bar" style={{ display: "block" }}>
                          <i style={{ width: `${v}%`, background: v >= 100 ? "var(--ok)" : undefined }} />
                        </span>
                      </div>
                    );
                  })}
                  </div>
                </details>
              );
            })}
          </>
        )
      )}

      {tab === "bayar" && (
        !P.termin.length && !addon.length ? (
          <div className="card small">Jadwal pembayaran belum tersedia.</div>
        ) : (
          <>
            {(total > 0 || dibayar > 0) && (
              <div className="grid3">
                <div className="stat"><div className="eb">Total nilai proyek</div><div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.1rem)" }}>{total > 0 ? rp(total) : "—"}</div></div>
                <div className="stat"><div className="eb">Sudah dibayar</div><div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.1rem)", color: "var(--ok)" }}>{rp(dibayar)}</div></div>
                <div className="stat"><div className="eb">Sisa</div><div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.1rem)", color: "var(--bad)" }}>{total > 0 ? rp(Math.max(0, total - dibayar)) : "—"}</div></div>
              </div>
            )}
            {/* Tanpa judul jenis termin ("Jasa produksi"): nilainya sudah tampil di Total nilai proyek. */}
            {JENIS_TERMIN.map(([jenis]) => {
              const daftar = P.termin.filter((t) => jenisTermin(t) === jenis);
              if (!daftar.length) return null;
              return (
                <section key={jenis} className="card">
                  <ul className="tl">
                    {daftar.map((t, n) => {
                      const masuk = dibayarTermin(t, nilaiT);
                      const sebagian = !t.lunas_tgl && masuk > 0;
                      const [lab, c] = t.lunas_tgl ? [`Lunas ${tgl(t.lunas_tgl)}`, "b-ok"] : sebagian ? ["Sebagian", "b-warn"] : ["Belum", "b-n"];
                      return (
                        <li key={n}>
                          <span className={`dot ${t.lunas_tgl ? "ok" : sebagian ? "warn" : ""}`} />
                          <div>
                            <b style={{ fontWeight: 500 }}>{judulTermin(n)}</b> <span className="small">({Number(t.persen)}%)</span>
                        {keteranganTermin(t) && <div className="small">{keteranganTermin(t)}</div>}
                            {nilaiT[jenis] > 0 && <div className="num">{rp(tagihanTermin(t, nilaiT))}</div>}
                            {sebagian && <div className="small">Sudah diterima {rp(masuk)}</div>}
                          </div>
                          <span className={`badge ${c}`}>{lab}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {addon.length > 0 && (
              <section className="card">
                <h3 style={{ marginBottom: 8 }}>Addons</h3>
                <ul className="tl">
                  {addon.map((x, n) => (
                    <li key={n}>
                      <span className={`dot ${x.lunas_tgl ? "ok" : ""}`} />
                      <div>
                        <b style={{ fontWeight: 500 }}>{x.nama}</b>
                        <div className="num">{rp(x.nilai)}</div>
                      </div>
                      <span className={`badge ${x.lunas_tgl ? "b-ok" : "b-n"}`}>{x.lunas_tgl ? `Lunas ${tgl(x.lunas_tgl)}` : "Belum"}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )
      )}

      {tab === "defect" && <Defect items={items} defect={P.defect || []} />}

      {tab === "info" && (
        <section className="card">
          <dl className="kv">
            <dt>Lokasi</dt><dd>{P.lokasi || "—"}</dd>
            <dt>Mulai</dt><dd>{tglTh(P.mulai)}</dd>
            <dt>Deadline</dt><dd>{P.deadline ? tglTh(P.deadline) : "—"}</dd>
            <dt>Supervisor</dt><dd>{P.supervisor || "—"}</dd>
            <dt>Rincian</dt><dd>{items.length} item · {areas.length} area</dd>
            {total > 0 && (<><dt>Nilai proyek</dt><dd className="num">{rp(total)}</dd></>)}
            <dt>Update terakhir</dt>
            <dd>
              {P.update_terakhir
                ? `${P.update_terakhir.oleh || "Tim Taraco"} · ${new Date(P.update_terakhir.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })}`
                : "—"}
            </dd>
          </dl>
        </section>
      )}
      </div>
    </main>
  );
}
