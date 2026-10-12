"use client";
import { useState } from "react";
import Link from "next/link";
import { useAksi } from "../../useAksi";
import Pesan from "../../Pesan";
import UnggahBoq from "../../UnggahBoq";
import TabBar from "../../../TabBar";
import {
  FASE, JENIS, JENIS_LABEL, tahapItem, persenItem, persenProyek, pakaiHarga,
  tahapTerakhir, tahapBerikut,
} from "@/lib/portal/progresBoq";
import { hariIni, tgl, rp, pct, angka } from "@/lib/portal/format";
import { bacaBoq, bacaBaris, formatLama } from "@/lib/portal/imporBoq";
import * as A from "../../aksi";

const WARNA = { produksi: "var(--ph1)", pengiriman: "var(--ph2)", instalasi: "var(--ph3)", retensi: "var(--ph4)" };
const JENIS_PENDEK = { HPL: "HPL", DUCO: "Duco", VENDOR: "Vendor", SIPIL: "Sipil" };
const TERMIN_DEFAULT = [["DP", 30], ["Termin 2 · progres 50%", 30], ["Termin 3 · serah terima", 35], ["Retensi", 5]];
const TABS = [["progres", "Progres"], ["item", "Item BOQ"], ["termin", "Termin"], ["klien", "Klien"], ["info", "Info"]];

export default function AdminProyek({ proyek, items, termin, klien, supervisors, staf }) {
  const admin = staf.role === "ADMIN";
  const [tab, setTab] = useState("progres");
  const aksi = useAksi();
  const nilai = items.reduce((a, i) => a + (Number(i.harga) || 0), 0);

  return (
    <main className="wrap">
      <Link href="/portal" className="back">← Semua proyek</Link>
      <div>
        <div className="eb">{[proyek.kode, proyek.klien_nama].filter(Boolean).join(" · ")}</div>
        <h1>{proyek.nama}</h1>
        {proyek.lokasi && <div className="small lok">{proyek.lokasi}</div>}
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "minmax(0,5fr) minmax(0,7fr)" }}>
        <div className="stat lead">
          <div className="eb">Progres</div>
          <div className="v num">{pct(persenProyek(items))}</div>
          <div className="s">{items.length} item · {pakaiHarga(items) ? "ditimbang harga" : "ditimbang bobot"}</div>
        </div>
        <div className="stat">
          <div className="eb">Nilai kontrak</div>
          <div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.05rem)" }}>{nilai ? rp(nilai) : "—"}</div>
          <div className="s">{nilai ? "jumlah harga item" : "harga belum diisi"}</div>
        </div>
      </div>
      {/* Supervisor hanya punya tab Progres, jadi tidak perlu navigasi. */}
      {admin && <TabBar tabs={TABS} value={tab} onChange={(k) => { setTab(k); aksi.setMsg(""); }} />}
      <Pesan aksi={aksi} />

      {tab === "progres" && <TabProgres items={items} aksi={aksi} />}
      {tab === "item" && <TabItem proyek={proyek} items={items} aksi={aksi} />}
      {tab === "termin" && <TabTermin proyek={proyek} termin={termin} nilai={nilai} aksi={aksi} />}
      {tab === "klien" && <TabKlien proyek={proyek} klien={klien} aksi={aksi} />}
      {tab === "info" && <TabInfo proyek={proyek} supervisors={supervisors} aksi={aksi} />}
    </main>
  );
}

function Chips({ areas, value, onChange }) {
  if (areas.length < 2) return null;
  return (
    <div className="chips" role="group" aria-label="Saring area">
      <button type="button" className="chip" aria-pressed={value === "all"} onClick={() => onChange("all")}>Semua</button>
      {areas.map((a) => (
        <button key={a} type="button" className="chip" aria-pressed={value === a} onClick={() => onChange(a)}>{a}</button>
      ))}
    </div>
  );
}

/* ---------- Progres: satu ketukan untuk tahap berikutnya, buka item untuk semua tahap ---------- */
function TabProgres({ items, aksi }) {
  const [tanggal, setTanggal] = useState(hariIni());
  const [area, setArea] = useState("all");
  const [buka, setBuka] = useState(null);
  const [busy, setBusy] = useState(null);
  const areas = [...new Set(items.map((i) => i.area))];
  const kunci = !!busy || aksi.sibuk;

  if (!items.length) return <div className="card small">Belum ada item BOQ. Admin perlu mengimpor item di tab Item BOQ.</div>;

  async function toggle(it, s) {
    const batal = !!it.progres[s.k];
    setBusy(`${it.id}:${s.k}`);
    await aksi.jalankan(
      () => A.setProgres(it.id, s.k, batal ? null : tanggal),
      batal ? `${s.label} dibatalkan · ${it.nama}` : `${s.label} ✓ ${tgl(tanggal)} · ${it.nama}`
    );
    setBusy(null);
  }

  return (
    <>
      <div className="card" style={{ padding: "8px 14px" }}>
        <label className="tglrow">
          <span>Tanggal selesai</span>
          <input className="inp" type="date" value={tanggal} max={hariIni()} onChange={(e) => setTanggal(e.target.value || hariIni())} />
        </label>
      </div>
      <p className="small" style={{ margin: 0 }}>
        Ketuk tombol <b>✓</b> untuk mencatat tahap berikutnya. Ketuk nama item untuk semua tahap.
      </p>
      <Chips areas={areas} value={area} onChange={setArea} />
      {areas.filter((a) => area === "all" || a === area).map((a) => {
        const its = items.filter((i) => i.area === a);
        return (
          <div key={a} className="stack" style={{ gap: 8 }}>
            <div className="area"><h2>{a}</h2><span className="num small">{pct(persenProyek(its))}</span></div>
            {its.map((it) => {
              const akhir = tahapTerakhir(it), next = tahapBerikut(it), open = buka === it.id;
              return (
                <div key={it.id} className={`item acc${open ? " open" : ""}`}>
                  <button type="button" className="acc-h" aria-expanded={open} onClick={() => setBuka(open ? null : it.id)}>
                    <span className="t">
                      <span className="nm">{it.nama}</span>
                      <span className="small">{[it.kode, JENIS_LABEL[it.jenis], it.dimensi].filter(Boolean).join(" · ")}</span>
                    </span>
                    <b className="num">{persenItem(it)}%</b>
                    <i className="chev" aria-hidden="true" />
                  </button>
                  <div className="track">
                    {tahapItem(it).map((s) => <span key={s.k} className={it.progres[s.k] ? "on" : ""} style={{ flex: s.w, "--c": WARNA[s.fase] }} />)}
                  </div>
                  {open ? (
                    <div className="acc-b">
                      {FASE.map((f) => {
                        const st = tahapItem(it).filter((s) => s.fase === f.k);
                        if (!st.length) return null;
                        return (
                          <div key={f.k}>
                            <div className="fl">{f.label}</div>
                            <div className="pills">
                              {st.map((s) => (
                                <button key={s.k} type="button" className="pill" aria-pressed={!!it.progres[s.k]}
                                  disabled={kunci} style={busy === `${it.id}:${s.k}` ? { opacity: 0.5 } : null}
                                  onClick={() => toggle(it, s)}>
                                  <span>{it.progres[s.k] ? "✓ " : ""}{s.label}</span>
                                  <span className="w">{it.progres[s.k] ? tgl(it.progres[s.k]) : `${s.w}%`}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="acc-q">
                      <span className="small">{akhir ? `${akhir.label} ✓ ${tgl(akhir.tgl)}` : "Belum mulai"}</span>
                      {next
                        ? <button type="button" className="quick" disabled={kunci} onClick={() => toggle(it, next)}>✓ {next.label}</button>
                        : <span className="badge b-ok">Selesai 100%</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

/* ---------- Item BOQ: impor + edit ---------- */
function TabItem({ proyek, items, aksi }) {
  const [teks, setTeks] = useState("");
  const [file, setFile] = useState(null); // { sheet, rows } dari UnggahBoq
  const [unggahKe, setUnggahKe] = useState(0); // ganti key = kosongkan pilihan file
  const [buka, setBuka] = useState(null);
  const preview = file ? bacaBaris(file.rows, items.length) : teks ? bacaBoq(teks, items.length) : [];
  const perArea = preview.reduce((a, p) => ((a[p.area] = (a[p.area] || 0) + 1), a), {});
  const ubah = (id, patch) => aksi.jalankan(() => A.ubahItem(id, patch));
  const areas = [...new Set(items.map((i) => i.area))];

  return (
    <>
      {areas.map((a) => (
        <div key={a} className="stack" style={{ gap: 8 }}>
          <div className="area"><h2>{a}</h2></div>
          {items.filter((i) => i.area === a).map((it) => {
            const open = buka === it.id;
            return (
              <div key={it.id} className={`item acc${open ? " open" : ""}`}>
                <button type="button" className="acc-h" aria-expanded={open} onClick={() => setBuka(open ? null : it.id)}>
                  <span className="t">
                    <span className="nm">{it.nama}</span>
                    <span className="small">
                      {[it.kode, JENIS_PENDEK[it.jenis], `${Number(it.qty).toLocaleString("id-ID")} ${it.satuan || ""}`.trim(), it.dimensi].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="num small">{it.harga ? rp(it.harga) : "—"}</span>
                  <i className="chev" aria-hidden="true" />
                </button>
                {open && (
                  <div className="acc-b">
                    <div>
                      <div className="fl">Jenis pekerjaan</div>
                      <div className="seg">
                        {JENIS.map((j) => (
                          <button key={j} type="button" aria-pressed={it.jenis === j} disabled={aksi.sibuk}
                            onClick={() => it.jenis !== j && ubah(it.id, { jenis: j })}>
                            {JENIS_PENDEK[j]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="g2" style={{ gridTemplateColumns: "minmax(0,1fr) 96px" }}>
                      <label className="lbl">Harga (Rp)
                        <input className="inp num" inputMode="numeric" placeholder="—" style={{ textAlign: "right" }}
                          defaultValue={it.harga ? Number(it.harga).toLocaleString("id-ID") : ""}
                          onBlur={(e) => { const v = angka(e.target.value); if (v !== (it.harga == null ? null : Number(it.harga))) ubah(it.id, { harga: v }); }} />
                      </label>
                      <label className="lbl">Bobot
                        <input className="inp num" inputMode="decimal" style={{ textAlign: "right" }}
                          defaultValue={Number(it.bobot).toLocaleString("id-ID")}
                          onBlur={(e) => { const v = angka(e.target.value); if (v > 0 && v !== Number(it.bobot)) ubah(it.id, { bobot: v }); }} />
                      </label>
                    </div>
                    <button type="button" className="act bahaya" disabled={aksi.sibuk}
                      onClick={() => confirm(`Hapus "${it.nama}" beserta progresnya?`) && aksi.jalankan(() => A.hapusItem(it.id), `${it.nama} dihapus.`)}>
                      Hapus item
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <div className="card stack">
        <h3>Impor dari Excel</h3>
        <p className="small" style={{ margin: 0 }}>
          Pilih file <b>BoQ</b>, lalu sheet proyeknya. Yang diambil hanya item bernomor (kabinet, wardrobe, dll.)
          beserta area, kode, dimensi, dan qty-nya; aksesoris tanpa nomor seperti LED, handle, dan stopkontak dilewati.
          Jenis (HPL / Duco / Vendor / Sipil) ditebak dari uraian dan bisa diubah per item. Harga diisi setelah impor.
        </p>
        <UnggahBoq key={unggahKe} petunjuk={[proyek.nama, proyek.kode]} onPilih={(f) => { setFile(f); aksi.setMsg(""); }} />
        {!file && (
          <details>
            <summary className="small" style={{ cursor: "pointer", minHeight: "var(--tap)", display: "flex", alignItems: "center" }}>
              Atau tempel baris dari Excel
            </summary>
            <div className="stack">
              <p className="small" style={{ margin: 0 }}>
                Buka sheet proyek, pilih semua (Ctrl+A), salin (Ctrl+C), lalu tempel di sini.
              </p>
              <textarea className="inp" value={teks} onChange={(e) => setTeks(e.target.value)}
                placeholder={"No.\tUraian\tPanjang\tLebar\tTinggi\tQty\nA\tFOYER\n1\tShoe Rack (FF.01)\t1,65\t0,4\t2,3\t1"} />
            </div>
          </details>
        )}
        {file && !preview.length && (
          <p className="note b-warn">Tidak ada item yang terbaca di sheet “{file.sheet}”. Pastikan ini sheet BoQ proyeknya.</p>
        )}
        {!file && teks.trim() && !preview.length && (
          <p className="note b-warn">
            Belum ada item yang terbaca. Salin langsung dari Excel mulai kolom <b>No.</b> sampai <b>Qty</b>, dan pastikan baris item punya nomor.
          </p>
        )}
        {preview.length > 0 && (
          <p className="small" style={{ margin: 0 }}>
            Terbaca <b>{preview.length}</b> item di <b>{Object.keys(perArea).length}</b> area (
            {Object.entries(preview.reduce((a, p) => ((a[p.jenis] = (a[p.jenis] || 0) + 1), a), {})).map(([j, n]) => `${n} ${JENIS_LABEL[j]}`).join(", ")}
            ): {Object.entries(perArea).map(([a, n]) => `${a} ${n}`).join(" · ")}
          </p>
        )}
        {file && preview.length > 0 && formatLama(file.rows) && (
          <p className="note b-warn">
            Sheet ini tidak memakai nomor item, jadi item ditebak dari baris yang punya dimensi. Periksa hasilnya dan hapus yang tidak perlu setelah impor.
          </p>
        )}
        {preview.length > 0 && items.length > 0 && (
          <p className="note b-warn">Proyek ini sudah punya {items.length} item. Impor ini menambah, bukan mengganti.</p>
        )}
        <button type="button" className="btn" disabled={aksi.sibuk || !preview.length}
          onClick={async () => {
            if (!(await aksi.jalankan(() => A.tambahItem(proyek.id, preview), `${preview.length} item ditambahkan.`))) return;
            setTeks("");
            setFile(null);
            setUnggahKe((n) => n + 1);
          }}>
          Tambahkan {preview.length || ""} item
        </button>
      </div>
    </>
  );
}

/* ---------- Termin ---------- */
function TabTermin({ proyek, termin, nilai, aksi }) {
  const total = termin.reduce((a, t) => a + Number(t.persen), 0);
  const ubah = (id, patch) => aksi.jalankan(() => A.ubahTermin(id, patch));

  if (!termin.length)
    return (
      <div className="card stack" style={{ textAlign: "center" }}>
        <p className="small" style={{ margin: 0 }}>Belum ada jadwal termin.</p>
        <button type="button" className="btn" disabled={aksi.sibuk}
          onClick={() => aksi.jalankan(() => A.tambahTermin(proyek.id, TERMIN_DEFAULT.map(([label, persen], n) => ({
            urutan: n, label, persen, jatuh_tempo: n === 2 ? proyek.deadline : null,
          }))), "Termin standar dibuat. Silakan sesuaikan.")}>
          Buat termin standar (30 / 30 / 35 / 5)
        </button>
      </div>
    );

  return (
    <>
      {total !== 100 && <p className="note b-warn">Total persen termin {total}%, seharusnya 100%.</p>}
      {termin.map((t) => (
        <div key={t.id} className="item">
          <div className="g2" style={{ gridTemplateColumns: "minmax(0,1fr) 84px" }}>
            <label className="lbl">Nama termin
              <input className="inp" style={{ fontWeight: 600 }} defaultValue={t.label}
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== t.label && ubah(t.id, { label: e.target.value.trim() })} />
            </label>
            <label className="lbl">Persen
              <input className="inp num" inputMode="decimal" style={{ textAlign: "right" }} defaultValue={Number(t.persen)}
                onBlur={(e) => { const v = angka(e.target.value); if (v > 0 && v <= 100 && v !== Number(t.persen)) ubah(t.id, { persen: v }); }} />
            </label>
          </div>
          <div className="g2">
            <label className="lbl">Jatuh tempo<input className="inp" type="date" defaultValue={t.jatuh_tempo || ""} onChange={(e) => ubah(t.id, { jatuh_tempo: e.target.value || null })} /></label>
            <label className="lbl">Lunas tanggal<input className="inp" type="date" defaultValue={t.lunas_tgl || ""} onChange={(e) => ubah(t.id, { lunas_tgl: e.target.value || null })} /></label>
          </div>
          <div className="row" style={{ alignItems: "center" }}>
            <span className={nilai ? "num" : "small"}>{nilai ? rp((nilai * t.persen) / 100) : "Nominal muncul setelah harga diisi"}</span>
            {t.lunas_tgl && <span className="badge b-ok">Lunas {tgl(t.lunas_tgl)}</span>}
          </div>
          <div className="acts">
            {!t.lunas_tgl && (
              <button type="button" className="act" disabled={aksi.sibuk} onClick={() => ubah(t.id, { lunas_tgl: hariIni() })}>Lunas hari ini</button>
            )}
            <button type="button" className="act bahaya" disabled={aksi.sibuk}
              onClick={() => confirm(`Hapus termin "${t.label}"?`) && aksi.jalankan(() => A.hapusTermin(t.id), "Termin dihapus.")}>
              Hapus
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn2" disabled={aksi.sibuk}
        onClick={() => aksi.jalankan(() => A.tambahTermin(proyek.id, [{
          urutan: termin.length, label: `Termin ${termin.length + 1}`, persen: Math.max(1, Math.min(100, 100 - total)),
        }]))}>
        + Tambah termin
      </button>
    </>
  );
}

/* ---------- Link klien ---------- */
function TabKlien({ proyek, klien, aksi }) {
  const [nama, setNama] = useState(proyek.klien_nama || "");
  const [disalin, setDisalin] = useState(null);
  const url = (token) => `${location.origin}/k/${token}`;
  const pesan = (k) =>
    `Halo${k.nama ? ` ${k.nama}` : ""}, progres proyek ${proyek.nama} dari Taraco bisa dipantau di link berikut:\n${url(k.id)}`;

  async function salin(k) {
    await navigator.clipboard.writeText(url(k.id));
    setDisalin(k.id);
    setTimeout(() => setDisalin(null), 2000);
  }

  return (
    <>
      <p className="small" style={{ margin: 0 }}>
        Klien membuka proyek lewat link rahasia, tanpa login. Siapa pun yang memegang link bisa melihat progres,
        deadline, dan termin proyek ini, jadi kirim hanya ke klien. Cabut link kalau tidak dipakai lagi.
      </p>
      {klien.map((k) => (
        <div key={k.id} className="item">
          <div style={{ minWidth: 0 }}>
            <b>{k.nama || "Tanpa nama"}</b>
            <div className="small">Dibuat {tgl(k.created_at.slice(0, 10))}</div>
          </div>
          <div className="acts">
            <button type="button" className="act" onClick={() => salin(k)}>{disalin === k.id ? "Tersalin ✓" : "Salin link"}</button>
            <a className="act" href={`https://wa.me/?text=${encodeURIComponent(pesan(k))}`} target="_blank" rel="noreferrer">Kirim WA</a>
            <button type="button" className="act bahaya" disabled={aksi.sibuk}
              onClick={() => confirm(`Cabut link ${k.nama || ""}? Link lama tidak bisa dibuka lagi.`) && aksi.jalankan(() => A.cabutLink(k.id), "Link dicabut.")}>
              Cabut
            </button>
          </div>
        </div>
      ))}
      <div className="card stack">
        <label className="lbl">Nama klien<input className="inp" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Bpk. Alfeus" /></label>
        <button type="button" className="btn" disabled={aksi.sibuk}
          onClick={() => aksi.jalankan(() => A.buatLink(proyek.id, nama), "Link dibuat. Salin atau kirim lewat WA.")}>
          Buat link klien
        </button>
      </div>
    </>
  );
}

/* ---------- Info proyek ---------- */
function TabInfo({ proyek, supervisors, aksi }) {
  const [f, setF] = useState({
    nama: proyek.nama, kode: proyek.kode || "", klien_nama: proyek.klien_nama || "", lokasi: proyek.lokasi || "",
    mulai: proyek.mulai, deadline: proyek.deadline || "", supervisor_id: proyek.supervisor_id || "", aktif: proyek.aktif,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <form className="card stack" onSubmit={(e) => {
      e.preventDefault();
      aksi.jalankan(() => A.ubahProyek(proyek.id, {
        nama: f.nama.trim(), kode: f.kode.trim() || null, klien_nama: f.klien_nama.trim() || null, lokasi: f.lokasi.trim() || null,
        mulai: f.mulai, deadline: f.deadline || null, supervisor_id: f.supervisor_id || null, aktif: f.aktif,
      }), "Info proyek disimpan.");
    }}>
      <label className="lbl">Nama proyek<input className="inp" required value={f.nama} onChange={set("nama")} /></label>
      <div className="g2">
        <label className="lbl">Kode<input className="inp" value={f.kode} onChange={set("kode")} /></label>
        <label className="lbl">Nama klien<input className="inp" value={f.klien_nama} onChange={set("klien_nama")} /></label>
      </div>
      <label className="lbl">Lokasi<input className="inp" value={f.lokasi} onChange={set("lokasi")} /></label>
      <div className="g2">
        <label className="lbl">Mulai<input className="inp" type="date" required value={f.mulai} onChange={set("mulai")} /></label>
        <label className="lbl">Deadline<input className="inp" type="date" value={f.deadline} onChange={set("deadline")} /></label>
      </div>
      <label className="lbl">Supervisor
        <select className="inp" value={f.supervisor_id} onChange={set("supervisor_id")}>
          <option value="">— Belum ditentukan —</option>
          {supervisors.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>
      </label>
      <label className="cek">
        <input type="checkbox" checked={!f.aktif} onChange={(e) => setF({ ...f, aktif: !e.target.checked })} />
        Arsipkan proyek (sudah selesai)
      </label>
      <button className="btn" disabled={aksi.sibuk}>Simpan</button>
    </form>
  );
}
