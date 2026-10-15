"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FASE, tahapItem, persenItem, persenProyek, persenFase, bobotFase, tahapTerakhir, faseKini, areaProgres } from "@/lib/portal/progresBoq";
import {
  hariIni, tambahHari, selisihHari, tgl, tglTh, rp, pct, nilaiKontrak, tagihanTermin, dibayarTermin, totalDibayar, statusProyek,
  JENIS_TERMIN, jenisTermin, nilaiTermin, totalNilai, labelDeadline,
} from "@/lib/portal/format";
import TabBar from "../../TabBar";

const WARNA = { produksi: "var(--ph1)", pengiriman: "var(--ph2)", instalasi: "var(--ph3)", retensi: "var(--ph4)" };

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
  const now = hariIni();
  const lalu = tambahHari(now, -7);
  const items = P.items;
  const p = persenProyek(items);
  const naik = p - persenProyek(items, lalu);
  const [st, cls] = statusProyek(P);
  const [sisa, kelasSisa] = P.deadline ? labelDeadline(P.deadline) : [];
  const areas = [...new Set(items.map((i) => i.area))];
  const nilai = nilaiKontrak(P);
  const nilaiT = nilaiTermin(P);
  const total = totalNilai(nilaiT);
  const dibayar = totalDibayar(P.termin, nilaiT);

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
            {naik > 0 ? <><span className="delta">+{pct(naik)}</span> dalam 7 hari terakhir</> : "Tidak ada perubahan 7 hari terakhir"}
          </div>
          {P.deadline && (
            <div className="small" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
              Deadline {tglTh(P.deadline)} <span className={`badge ${kelasSisa}`}>{sisa}</span>
            </div>
          )}
        </div>
      </section>

      <TabBar
        tabs={[["progres", "Progres"], nilai > 0 && ["rincian", "Rincian"], ["bayar", "Pembayaran"], ["info", "Info"]].filter(Boolean)}
        value={tab}
        onChange={setTab}
      />

      {tab === "progres" && (
        !items.length ? (
          <div className="card small">Rincian pekerjaan sedang disiapkan tim kami.</div>
        ) : (
          <>
            <section className="card">
              <div className="phasebar">
                {FASE.map((f) => {
                  const max = bobotFase(items, f.k);
                  if (!max) return null;
                  return (
                    <div key={f.k} style={{ flex: max }}>
                      <i style={{ width: `${(persenFase(items, f.k) / max) * 100}%`, background: WARNA[f.k] }} />
                    </div>
                  );
                })}
              </div>
              <div className="legend">
                {FASE.filter((f) => bobotFase(items, f.k)).map((f) => (
                  <div key={f.k} style={{ "--c": WARNA[f.k] }}>
                    <b>{f.label}</b>
                    <span className="num small">{pct(persenFase(items, f.k))} / {pct(bobotFase(items, f.k))}</span>
                  </div>
                ))}
              </div>
            </section>
            {areas.filter(areaProgres).map((a) => {
              const its = items.filter((i) => i.area === a);
              return (
                <details key={a} className="lipat">
                  <summary>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="row">
                        <h2>{a}</h2>
                        <span className="num small" style={{ margin: 0, whiteSpace: "nowrap" }}>{pct(persenProyek(its))} · {its.length} item</span>
                      </span>
                      <span className="bar" style={{ display: "block", marginTop: 8 }}><i style={{ width: `${persenProyek(its)}%` }} /></span>
                    </span>
                  </summary>
                  <div className="lipat-b">
                  {its.map((it) => {
                    const v = persenItem(it);
                    const kini = tahapTerakhir(it), fase = faseKini(it);
                    return (
                      <div key={it.id} className="item mini">
                        <div className="row">
                          <div style={{ minWidth: 0 }}>
                            {it.kode && <div className="small num">{it.kode}</div>}
                            <h3>{it.nama}</h3>
                          </div>
                          <b className="num">{v}%</b>
                        </div>
                        {/* Klien cukup melihat satu bar polos untuk fase yang sedang berjalan
                            (Produksi -> Pengiriman -> ...), tanpa rincian tiap tahap. */}
                        <span className="bar" style={{ display: "block" }}>
                          <i style={{ width: `${fase ? fase.persen : 100}%`, background: fase ? WARNA[fase.k] : "var(--ok)" }} />
                        </span>
                        {/* Stage saat ini = tahap yang terakhir dicatat (tanggal paling baru). */}
                        <div className="small">
                          {!fase ? "Selesai" : <>{fase.label} {pct(fase.persen)} · {kini ? `Stage saat ini: ${kini.label}` : "Belum dimulai"}</>}
                        </div>
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
        !P.termin.length ? (
          <div className="card small">Jadwal pembayaran belum tersedia.</div>
        ) : (
          <>
            {(total > 0 || dibayar > 0) && (
              <div className="grid2">
                <div className="stat"><div className="eb">Sudah dibayar</div><div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.1rem)", color: "var(--ok)" }}>{rp(dibayar)}</div></div>
                <div className="stat"><div className="eb">Sisa</div><div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.1rem)", color: "var(--bad)" }}>{total > 0 ? rp(Math.max(0, total - dibayar)) : "—"}</div></div>
              </div>
            )}
            {JENIS_TERMIN.map(([jenis, judul]) => {
              const daftar = P.termin.filter((t) => jenisTermin(t) === jenis);
              if (!daftar.length) return null;
              return (
                <section key={jenis} className="card">
                  <div className="row" style={{ marginBottom: 4 }}>
                    <h3>{judul}</h3>
                    {nilaiT[jenis] > 0 && <span className="num small">{rp(nilaiT[jenis])}</span>}
                  </div>
                  <ul className="tl">
                    {daftar.map((t, n) => {
                      const telat = !t.lunas_tgl && t.jatuh_tempo && t.jatuh_tempo < now;
                      const segera = !t.lunas_tgl && !telat && t.jatuh_tempo && selisihHari(now, t.jatuh_tempo) <= 7;
                      const masuk = dibayarTermin(t, nilaiT);
                      const sebagian = !t.lunas_tgl && masuk > 0;
                      const [lab, c] = t.lunas_tgl ? [`Lunas ${tgl(t.lunas_tgl)}`, "b-ok"] : telat ? ["Jatuh tempo", "b-bad"] : segera ? ["Segera", "b-warn"] : sebagian ? ["Sebagian", "b-warn"] : ["Belum", "b-n"];
                      return (
                        <li key={n}>
                          <span className={`dot ${t.lunas_tgl ? "ok" : telat || segera ? "warn" : ""}`} />
                          <div>
                            <b style={{ fontWeight: 500 }}>{t.label}</b> <span className="small">({Number(t.persen)}%)</span>
                            {t.jatuh_tempo && <div className="small">Jatuh tempo {tglTh(t.jatuh_tempo)}</div>}
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
          </>
        )
      )}

      {tab === "rincian" && (
        <>
          {areas.map((a) => {
            const its = items.filter((i) => i.area === a);
            return (
              <details key={a} className="lipat">
                <summary>
                  <span style={{ minWidth: 0, flex: 1 }}><h2>{a}</h2><span className="small">{its.length} item</span></span>
                  <b className="num">{rp(nilaiKontrak({ items: its }))}</b>
                </summary>
                <div className="lipat-b garis">
                {its.map((it) => (
                  <div key={it.id} className="baris">
                    <div style={{ minWidth: 0 }}>
                      <div className="nm">{it.nama}</div>
                      <div className="small">
                        {[`${Number(it.qty).toLocaleString("id-ID")} ${it.satuan || ""}`.trim(), it.dimensi].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span className="num">{Number(it.harga) > 0 ? rp(it.harga) : "—"}</span>
                  </div>
                ))}
                </div>
              </details>
            );
          })}
          <div className="stat lead row" style={{ alignItems: "center" }}>
            <div className="eb">Total nilai kontrak</div>
            <div className="v num" style={{ fontSize: "1.15rem", marginTop: 0 }}>{rp(nilai)}</div>
          </div>
        </>
      )}

      {tab === "info" && (
        <section className="card">
          <dl className="kv">
            <dt>Lokasi</dt><dd>{P.lokasi || "—"}</dd>
            <dt>Mulai</dt><dd>{tglTh(P.mulai)}</dd>
            <dt>Deadline</dt><dd>{P.deadline ? tglTh(P.deadline) : "—"}</dd>
            <dt>Supervisor</dt><dd>{P.supervisor || "—"}</dd>
            <dt>Rincian</dt><dd>{items.length} item · {areas.length} area</dd>
            {nilai > 0 && (<><dt>Nilai kontrak</dt><dd className="num">{rp(nilai)}</dd></>)}
            <dt>Update terakhir</dt>
            <dd>
              {P.update_terakhir
                ? `${P.update_terakhir.oleh || "Tim Taraco"} · ${new Date(P.update_terakhir.at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })}`
                : "—"}
            </dd>
          </dl>
        </section>
      )}
    </main>
  );
}
