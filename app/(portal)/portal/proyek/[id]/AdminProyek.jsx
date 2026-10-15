"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAksi } from "../../useAksi";
import Pesan from "../../Pesan";
import UnggahBoq from "../../UnggahBoq";
import TabBar from "../../../TabBar";
import {
  FASE, JENIS, JENIS_LABEL, tahapItem, persenItem, persenProyek, pakaiHarga, semuaBerharga, beriBerat,
  tahapTerakhir, tahapBerikut,
} from "@/lib/portal/progresBoq";
import {
  hariIni, tgl, rp, pct, angka, tagihanTermin, dibayarTermin, totalDibayar,
  JENIS_TERMIN, jenisTermin, nilaiTermin, totalNilai, terminStandar, BATAS_PERANCANGAN,
} from "@/lib/portal/format";
import { bacaBoq, bacaBaris, formatLama } from "@/lib/portal/imporBoq";
import * as A from "../../aksi";

const WARNA = { produksi: "var(--ph1)", pengiriman: "var(--ph2)", instalasi: "var(--ph3)", retensi: "var(--ph4)" };
const JENIS_PENDEK = { HPL: "HPL", DUCO: "Duco", VENDOR: "Vendor", SIPIL: "Sipil" };
const TABS = [["progres", "Progres"], ["item", "Item BOQ"], ["termin", "Termin"], ["klien", "Klien"], ["info", "Info"]];

export default function AdminProyek({ proyek, items, termin, klien, supervisors, staf }) {
  const admin = staf.role === "ADMIN";
  const [tab, setTab] = useState("progres");
  const aksi = useAksi();
  const nilai = items.reduce((a, i) => a + (Number(i.harga) || 0), 0);
  const nilaiT = nilaiTermin({ ...proyek, items });

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
          <div className="s">{items.length} item · {pakaiHarga(items, proyek.timbang_harga) ? "ditimbang harga" : "ditimbang bobot"}</div>
        </div>
        <div className="stat">
          <div className="eb">Nilai kontrak</div>
          <div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.05rem)" }}>{totalNilai(nilaiT) ? rp(totalNilai(nilaiT)) : "—"}</div>
          <div className="s">
            {nilaiT.perancangan ? (nilai ? "BOQ + jasa perancangan" : "jasa perancangan · harga BOQ belum diisi") : nilai ? "jumlah harga item" : "harga belum diisi"}
          </div>
        </div>
      </div>
      {/* Supervisor hanya punya tab Progres, jadi tidak perlu navigasi. */}
      {admin && <TabBar tabs={TABS} value={tab} onChange={(k) => { setTab(k); aksi.setMsg(""); }} />}
      <Pesan aksi={aksi} />

      {tab === "progres" && <TabProgres items={items} aksi={aksi} />}
      {tab === "item" && <TabItem proyek={proyek} items={items} aksi={aksi} />}
      {tab === "termin" && <TabTermin proyek={proyek} items={items} termin={termin} nilai={nilaiT} aksi={aksi} />}
      {tab === "klien" && <TabKlien proyek={proyek} klien={klien} aksi={aksi} />}
      {tab === "info" && <TabInfo proyek={proyek} supervisors={supervisors} aksi={aksi} />}
    </main>
  );
}

// Kolom harga: angka langsung tampil sebagai rupiah saat diketik ("Rp 4.500.000")
// dan disimpan saat pindah dari kolom. Kosong = harga belum diisi.
const rupiah = (n) => (n ? `Rp ${Number(n).toLocaleString("id-ID")}` : "");

function InputRupiah({ nilai, onSimpan }) {
  const [teks, setTeks] = useState(rupiah(nilai));
  useEffect(() => setTeks(rupiah(nilai)), [nilai]);
  const angkaNya = (s) => Number(s.replace(/\D/g, "")) || null;
  return (
    <input className="inp num" inputMode="numeric" placeholder="Rp 0" style={{ textAlign: "right" }}
      value={teks}
      onChange={(e) => setTeks(rupiah(angkaNya(e.target.value)))}
      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
      onBlur={() => { const v = angkaNya(teks); if (v !== (nilai == null ? null : Number(nilai))) onSimpan(v); }} />
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

/* ---------- Item BOQ: penimbang, edit, tambah, impor ---------- */
const teksQty = (i) => `${Number(i.qty).toLocaleString("id-ID")} ${i.satuan || ""}`.trim();
// Item dianggap sama kalau area, nama, dan kodenya sama.
const kunciItem = (i) => [i.area, i.nama, i.kode].map((x) => (x || "").toLowerCase().replace(/\s+/g, " ").trim()).join("|");

// Kolom yang tersimpan saat pindah dari kolom (atau Enter). onSimpan(v)
// mengembalikan false kalau ditolak; isi kolom lalu kembali ke nilai semula.
function Isian({ label, nilai, onSimpan, ...rest }) {
  const awal = String(nilai ?? "");
  return (
    <label className="lbl">{label}
      <input className="inp" defaultValue={awal} {...rest}
        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
        onBlur={async (e) => {
          const el = e.target, v = el.value.trim();
          if (v !== awal && !(await onSimpan(v))) el.value = awal;
        }} />
    </label>
  );
}

// Penimbang progres antar item: bobot atau harga. Dipilih admin, supaya angka
// yang dilihat klien tidak berubah sendiri saat harga terakhir diisi.
function Penimbang({ proyek, items, aksi }) {
  if (!items.length) return null;
  const pilih = proyek.timbang_harga;
  const lengkap = semuaBerharga(items);
  const kosong = items.filter((i) => !(Number(i.harga) > 0)).length;
  const pBobot = pct(persenProyek(beriBerat(items, false)));
  const pHarga = lengkap ? pct(persenProyek(beriBerat(items, true))) : null;
  const ganti = (ke) =>
    confirm(`Progres proyek yang dilihat klien berubah dari ${ke ? pBobot : pHarga} menjadi ${ke ? pHarga : pBobot}. Lanjutkan?`) &&
    aksi.jalankan(() => A.ubahProyek(proyek.id, { timbang_harga: ke }), `Progres sekarang ditimbang ${ke ? "harga" : "bobot"}.`);

  return (
    <div className="card stack">
      <div className="row" style={{ alignItems: "center" }}>
        <h3>Penimbang progres</h3>
        <span className="badge b-n">{pakaiHarga(items, pilih) ? "Harga" : "Bobot"}</span>
      </div>
      {pilih == null ? (
        <p className="small" style={{ margin: 0 }}>
          Progres ditimbang harga kalau semua item sudah berharga, selain itu bobot. Untuk memilih sendiri, jalankan{" "}
          <b>supabase/add_portal_pembayaran.sql</b> di Supabase.
        </p>
      ) : !pilih ? (
        <>
          <p className="small" style={{ margin: 0 }}>
            Item berbobot besar menyumbang lebih banyak ke progres proyek (sekarang {pBobot}). Mengisi harga tidak mengubah angka ini.{" "}
            {lengkap
              ? `Semua harga sudah terisi; kalau ditimbang harga, progres menjadi ${pHarga}.`
              : `${kosong} item belum ada harga, jadi penimbang harga belum bisa dipakai.`}
          </p>
          {lengkap && <button type="button" className="act" disabled={aksi.sibuk} onClick={() => ganti(true)}>Timbang dengan harga</button>}
        </>
      ) : lengkap ? (
        <>
          <p className="small" style={{ margin: 0 }}>
            Item yang lebih mahal menyumbang lebih banyak ke progres proyek (sekarang {pHarga}). Kalau ditimbang bobot: {pBobot}.
          </p>
          <button type="button" className="act" disabled={aksi.sibuk} onClick={() => ganti(false)}>Kembali ke bobot</button>
        </>
      ) : (
        <p className="note b-warn">
          Proyek ini ditimbang harga, tetapi {kosong} item belum ada harga, jadi sementara progres ditimbang bobot ({pBobot}).
          Isi harganya supaya kembali ditimbang harga.
        </p>
      )}
    </div>
  );
}

function TabItem({ proyek, items, aksi }) {
  const [buka, setBuka] = useState(null);
  // `ok` = pesan hijau setelah tersimpan.
  const ubah = (id, patch, ok) => aksi.jalankan(() => A.ubahItem(id, patch), ok);
  const areas = [...new Set(items.map((i) => i.area))];
  const urutan = items.reduce((m, i) => Math.max(m, i.urutan), -1) + 1; // untuk item baru

  return (
    <>
      <Penimbang proyek={proyek} items={items} aksi={aksi} />
      <datalist id="daftar-area">{areas.map((a) => <option key={a} value={a} />)}</datalist>

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
                      {[it.kode, JENIS_PENDEK[it.jenis], teksQty(it), it.dimensi].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="num small">{it.harga ? rp(it.harga) : "—"}</span>
                  <i className="chev" aria-hidden="true" />
                </button>
                {open && (
                  <div className="acc-b">
                    <Isian label="Nama item" nilai={it.nama}
                      onSimpan={(v) => !!v && ubah(it.id, { nama: v }, `Nama item disimpan: ${v}`)} />
                    <div className="g2">
                      <Isian label="Area" nilai={it.area} list="daftar-area"
                        onSimpan={(v) => !!v && ubah(it.id, { area: v }, `${it.nama} dipindah ke ${v}.`)} />
                      <Isian label="Kode" nilai={it.kode}
                        onSimpan={(v) => ubah(it.id, { kode: v || null }, `Kode ${it.nama} disimpan.`)} />
                    </div>
                    <div className="g2" style={{ gridTemplateColumns: "72px 88px minmax(0,1fr)" }}>
                      <Isian label="Qty" inputMode="decimal" nilai={Number(it.qty).toLocaleString("id-ID")}
                        onSimpan={(v) => angka(v) > 0 && ubah(it.id, { qty: angka(v) }, `Qty ${it.nama} disimpan.`)} />
                      <Isian label="Satuan" nilai={it.satuan}
                        onSimpan={(v) => ubah(it.id, { satuan: v || null }, `Satuan ${it.nama} disimpan.`)} />
                      <Isian label="Dimensi" nilai={it.dimensi}
                        onSimpan={(v) => ubah(it.id, { dimensi: v || null }, `Dimensi ${it.nama} disimpan.`)} />
                    </div>
                    <div>
                      <div className="fl">Jenis pekerjaan</div>
                      <div className="seg">
                        {JENIS.map((j) => (
                          <button key={j} type="button" aria-pressed={it.jenis === j} disabled={aksi.sibuk}
                            onClick={() => it.jenis !== j && ubah(it.id, { jenis: j }, `Jenis ${it.nama} diubah ke ${JENIS_LABEL[j]}.`)}>
                            {JENIS_PENDEK[j]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="g2" style={{ gridTemplateColumns: "minmax(0,1fr) 96px" }}>
                      <label className="lbl">Harga (total item)
                        <InputRupiah nilai={it.harga}
                          onSimpan={(v) => ubah(it.id, { harga: v }, v ? `Harga ${it.nama} disimpan: ${rp(v)}` : `Harga ${it.nama} dikosongkan.`)} />
                      </label>
                      <Isian label="Bobot" inputMode="decimal" style={{ textAlign: "right" }} nilai={Number(it.bobot).toLocaleString("id-ID")}
                        onSimpan={(v) => angka(v) > 0 && ubah(it.id, { bobot: angka(v) }, `Bobot ${it.nama} disimpan: ${angka(v).toLocaleString("id-ID")}`)} />
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

      <TambahItem proyek={proyek} areas={areas} urutan={urutan} aksi={aksi} />
      <ImporBoq proyek={proyek} items={items} urutan={urutan} aksi={aksi} />
    </>
  );
}

function TambahItem({ proyek, areas, urutan, aksi }) {
  const kosong = { area: areas[areas.length - 1] || "", nama: "", kode: "", jenis: "HPL", qty: "1", satuan: "unit", dimensi: "", harga: null };
  const [f, setF] = useState(kosong);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <details className="lipat">
      <summary><b>+ Tambah item manual</b></summary>
      <form className="lipat-b" style={{ gap: 12 }} onSubmit={async (e) => {
        e.preventDefault();
        const nama = f.nama.trim();
        const ok = await aksi.jalankan(() => A.tambahItem(proyek.id, [{
          area: f.area.trim(), nama, kode: f.kode.trim() || null, jenis: f.jenis, qty: angka(f.qty) || 1,
          satuan: f.satuan.trim() || null, dimensi: f.dimensi.trim() || null, harga: f.harga, bobot: 1, urutan,
        }]), `${nama} ditambahkan.`);
        // Area dan jenis dipertahankan untuk item berikutnya.
        if (ok) setF({ ...kosong, area: f.area, jenis: f.jenis });
      }}>
        <label className="lbl">Nama item<input className="inp" required value={f.nama} onChange={set("nama")} placeholder="Lemari pakaian 2 pintu" /></label>
        <div className="g2">
          <label className="lbl">Area<input className="inp" required list="daftar-area" value={f.area} onChange={set("area")} placeholder="Kamar Anak" /></label>
          <label className="lbl">Kode<input className="inp" value={f.kode} onChange={set("kode")} placeholder="FF.01" /></label>
        </div>
        <div className="g2" style={{ gridTemplateColumns: "72px 88px minmax(0,1fr)" }}>
          <label className="lbl">Qty<input className="inp" inputMode="decimal" value={f.qty} onChange={set("qty")} /></label>
          <label className="lbl">Satuan<input className="inp" value={f.satuan} onChange={set("satuan")} /></label>
          <label className="lbl">Dimensi<input className="inp" value={f.dimensi} onChange={set("dimensi")} placeholder="1,8 × 0,6 × 2,4 m" /></label>
        </div>
        <div>
          <div className="fl">Jenis pekerjaan</div>
          <div className="seg">
            {JENIS.map((j) => (
              <button key={j} type="button" aria-pressed={f.jenis === j} onClick={() => setF({ ...f, jenis: j })}>{JENIS_PENDEK[j]}</button>
            ))}
          </div>
        </div>
        <label className="lbl">Harga (total item, boleh kosong)
          <InputRupiah nilai={f.harga} onSimpan={(v) => setF((x) => ({ ...x, harga: v }))} />
        </label>
        <button className="btn" disabled={aksi.sibuk || !f.nama.trim() || !f.area.trim()}>Tambah item</button>
      </form>
    </details>
  );
}

function ImporBoq({ proyek, items, urutan, aksi }) {
  const [teks, setTeks] = useState("");
  const [file, setFile] = useState(null); // { sheet, rows } dari UnggahBoq
  const [unggahKe, setUnggahKe] = useState(0); // ganti key = kosongkan pilihan file
  const [ganti, setGanti] = useState(false); // false = menambah, true = mengganti seluruh BOQ
  const [centang, setCentang] = useState({}); // { [n]: true/false } centang yang diubah admin
  const [jenis, setJenis] = useState({}); // { [n]: jenis } tebakan jenis yang dibetulkan admin
  const preview = useMemo(() => (file ? bacaBaris(file.rows, urutan) : teks ? bacaBoq(teks, urutan) : []), [file, teks, urutan]);
  const sudahAda = useMemo(() => new Set(items.map(kunciItem)), [items]);

  // Saat menambah, baris yang sudah ada di proyek tidak dicentang (impor dua kali tidak menggandakan).
  const kembar = (p) => !ganti && sudahAda.has(kunciItem(p));
  const dipakai = (p, n) => centang[n] ?? !kembar(p);
  const terpilih = preview.map((p, n) => ({ ...p, jenis: jenis[n] || p.jenis })).filter((p, n) => dipakai(p, n));
  const nKembar = preview.filter(kembar).length;
  const nProgres = items.reduce((a, i) => a + Object.keys(i.progres).length, 0);
  const areaPv = [...new Set(preview.map((p) => p.area))];
  const sumberBaru = () => { setCentang({}); setJenis({}); };

  async function simpan() {
    if (ganti && !confirm(`Ganti seluruh BOQ? ${items.length} item lama${nProgres ? ` dan ${nProgres} centang progresnya` : ""} akan dihapus.`)) return;
    const ok = await aksi.jalankan(
      () => (ganti ? A.gantiItem(proyek.id, terpilih) : A.tambahItem(proyek.id, terpilih)),
      ganti ? `BOQ diganti dengan ${terpilih.length} item.` : `${terpilih.length} item ditambahkan.`
    );
    if (!ok) return;
    setTeks("");
    setFile(null);
    setGanti(false);
    sumberBaru();
    setUnggahKe((n) => n + 1);
  }

  return (
    <div className="card stack">
      <h3>Impor dari Excel</h3>
      <p className="small" style={{ margin: 0 }}>
        Pilih file <b>BoQ</b>, lalu sheet proyeknya. Yang diambil hanya item bernomor (kabinet, wardrobe, dll.)
        beserta area, kode, dimensi, dan qty-nya; aksesoris tanpa nomor seperti LED, handle, dan stopkontak dilewati.
        Jenis (HPL / Duco / Vendor / Sipil) ditebak dari uraian, dan bobot awal diperkirakan dari ukuran item;
        keduanya bisa diubah. Harga diisi setelah impor.
      </p>
      <UnggahBoq key={unggahKe} petunjuk={[proyek.nama, proyek.kode]} onPilih={(f) => { setFile(f); sumberBaru(); aksi.setMsg(""); }} />
      {!file && (
        <details>
          <summary className="small" style={{ cursor: "pointer", minHeight: "var(--tap)", display: "flex", alignItems: "center" }}>
            Atau tempel baris dari Excel
          </summary>
          <div className="stack">
            <p className="small" style={{ margin: 0 }}>
              Buka sheet proyek, pilih semua (Ctrl+A), salin (Ctrl+C), lalu tempel di sini.
            </p>
            <textarea className="inp" value={teks} onChange={(e) => { setTeks(e.target.value); sumberBaru(); }}
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
        <>
          {file && formatLama(file.rows) && (
            <p className="note b-warn">
              Sheet ini tidak memakai nomor item, jadi item ditebak dari baris yang punya dimensi. Periksa daftarnya dan hilangkan centang yang bukan item.
            </p>
          )}
          {items.length > 0 && (
            <div>
              <div className="fl">Proyek ini sudah punya {items.length} item</div>
              <div className="seg">
                <button type="button" aria-pressed={!ganti} onClick={() => { setGanti(false); setCentang({}); }}>Tambahkan</button>
                <button type="button" aria-pressed={ganti} onClick={() => { setGanti(true); setCentang({}); }}>Ganti seluruh BOQ</button>
              </div>
            </div>
          )}
          {ganti && (
            <p className="note b-bad">
              Semua {items.length} item lama dihapus{nProgres ? ` beserta ${nProgres} centang progresnya` : ""}, lalu diganti item yang dicentang di bawah.
            </p>
          )}
          {nKembar > 0 && (
            <p className="note b-warn">
              {nKembar} item sudah ada di proyek ini (area, nama, dan kode sama), jadi tidak dicentang.
            </p>
          )}
          <p className="small" style={{ margin: 0 }}>
            Terbaca <b>{preview.length}</b> item di <b>{areaPv.length}</b> area, <b>{terpilih.length}</b> dicentang.
            Hilangkan centang untuk melewati baris, dan betulkan jenisnya kalau tebakannya salah.
          </p>
          <div>
            {areaPv.map((a) => (
              <div key={a}>
                <div className="fl" style={{ margin: "12px 0 0" }}>{a}</div>
                {preview.map((p, n) => p.area !== a ? null : (
                  <div key={n} className={`pv${dipakai(p, n) ? "" : " off"}`}>
                    <input type="checkbox" aria-label={`Impor ${p.nama}`} checked={dipakai(p, n)}
                      onChange={(e) => setCentang({ ...centang, [n]: e.target.checked })} />
                    <span className="t">
                      <span className="nm">{p.nama}</span>
                      <span className="small">{[p.kode, teksQty(p), p.dimensi, kembar(p) && "sudah ada"].filter(Boolean).join(" · ")}</span>
                    </span>
                    <select className="inp" aria-label={`Jenis ${p.nama}`} value={jenis[n] || p.jenis}
                      onChange={(e) => setJenis({ ...jenis, [n]: e.target.value })}>
                      {JENIS.map((j) => <option key={j} value={j}>{JENIS_PENDEK[j]}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
      <button type="button" className="btn" disabled={aksi.sibuk || !terpilih.length} onClick={simpan}>
        {ganti ? `Ganti dengan ${terpilih.length} item` : `Tambahkan ${terpilih.length || ""} item`}
      </button>
    </div>
  );
}

/* ---------- Termin ---------- */
// Termin dibagi dua: jasa perancangan (dari nilai perancangan) dan jasa produksi
// (dari jumlah harga item BOQ). Persen tiap jenis berjumlah 100%.
function TabTermin({ proyek, items, termin, nilai, aksi }) {
  const masuk = totalDibayar(termin, nilai);
  const total = totalNilai(nilai);
  return (
    <>
      {(total > 0 || masuk > 0) && (
        <div className="grid2">
          <div className="stat"><div className="eb">Sudah diterima</div><div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.1rem)", color: "var(--ok)" }}>{rp(masuk)}</div></div>
          <div className="stat"><div className="eb">Sisa</div><div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.1rem)", color: "var(--bad)" }}>{total > 0 ? rp(Math.max(0, total - masuk)) : "—"}</div></div>
        </div>
      )}
      {JENIS_TERMIN.map(([jenis, judul]) => (
        <KelompokTermin key={jenis} jenis={jenis} judul={judul} proyek={proyek} progres={persenProyek(items)}
          termin={termin.filter((t) => jenisTermin(t) === jenis)} nilai={nilai} aksi={aksi} />
      ))}
    </>
  );
}

const polaPersen = (rows) => rows.map((p) => Number(p).toLocaleString("id-ID")).join(" / ");

function KelompokTermin({ jenis, judul, proyek, progres, termin, nilai, aksi }) {
  const n = nilai[jenis];
  const total = Math.round(termin.reduce((a, t) => a + Number(t.persen), 0) * 100) / 100;
  const ubah = (id, patch, ok) => aksi.jalankan(() => A.ubahTermin(id, patch), ok);
  // Menandai lunas mengunci nominalnya, supaya tidak ikut berubah kalau harga diubah belakangan.
  const kunci = (t) => (n ? { dibayar: tagihanTermin(t, nilai) } : {});
  const lunas = (t, tanggal) => ubah(t.id, { lunas_tgl: tanggal, ...kunci(t) }, `${t.label} lunas ${tgl(tanggal)}.`);
  const standar = polaPersen(terminStandar(jenis, n).map(([, p]) => p));
  const sesuai = polaPersen(termin.map((t) => t.persen)) === standar;
  const adaBayar = termin.some((t) => t.lunas_tgl || Number(t.dibayar) > 0);
  // Perancangan dibagi 3 atau 4 tergantung nilainya, jadi nilainya harus ada dulu.
  const bisaStandar = jenis === "produksi" || n > 0;
  const buatStandar = () =>
    aksi.jalankan(() => A.buatTerminStandar(proyek.id, jenis), `Termin ${judul.toLowerCase()} dibuat (${standar}).`);
  const aturan = jenis === "produksi"
    ? "DP 50%, 40% saat progres 50%, pelunasan 10%."
    : `di bawah ${rp(BATAS_PERANCANGAN)} dibagi 3 (50 / 40 / 10), ${rp(BATAS_PERANCANGAN)} ke atas dibagi 4 (40 / 30 / 20 / 10).`;

  return (
    <section className="stack">
      <div className="row" style={{ marginTop: 6 }}>
        <h2>{judul}</h2>
        {jenis === "produksi" && <span className="small num">progres {pct(progres)}</span>}
      </div>
      {jenis === "perancangan" ? (
        <label className="lbl">Nilai jasa perancangan
          <InputRupiah nilai={proyek.nilai_perancangan}
            onSimpan={(v) => aksi.jalankan(() => A.ubahProyek(proyek.id, { nilai_perancangan: v }),
              v ? `Nilai jasa perancangan ${rp(v)}.` : "Nilai jasa perancangan dikosongkan.")} />
        </label>
      ) : (
        <div className="row small">
          <span>Nilai = jumlah harga item BOQ</span>
          <span className="num">{n ? rp(n) : "harga belum diisi"}</span>
        </div>
      )}
      <p className="small" style={{ margin: 0 }}>Aturan: {aturan}</p>

      {!termin.length ? (
        <div className="card stack" style={{ textAlign: "center" }}>
          <p className="small" style={{ margin: 0 }}>
            {bisaStandar ? "Belum ada jadwal termin." : "Isi nilai jasa perancangan dulu. Kosongkan kalau proyek ini tanpa jasa perancangan."}
          </p>
          {bisaStandar && (
            <button type="button" className="btn" disabled={aksi.sibuk} onClick={buatStandar}>
              Buat termin standar ({standar})
            </button>
          )}
        </div>
      ) : (
        <>
          {total !== 100 && (
            <p className="note b-warn">
              Total persen termin {total.toLocaleString("id-ID")}%, {total < 100 ? `kurang ${(100 - total).toLocaleString("id-ID")}%` : `lebih ${(total - 100).toLocaleString("id-ID")}%`} dari 100%.
            </p>
          )}
          {!sesuai && bisaStandar && (
            <div className="note b-warn stack" style={{ gap: 8 }}>
              <span>Pola termin belum sesuai aturan, seharusnya {standar}.</span>
              {!adaBayar && (
                <button type="button" className="act" style={{ alignSelf: "flex-start" }} disabled={aksi.sibuk}
                  onClick={() => confirm(`Ganti semua termin ${judul.toLowerCase()} dengan pola ${standar}?`) && buatStandar()}>
                  Susun ulang sesuai aturan
                </button>
              )}
            </div>
          )}
          {termin.map((t) => {
            const diterima = dibayarTermin(t, nilai);
            return (
              <div key={t.id} className="item">
                <div className="g2" style={{ gridTemplateColumns: "minmax(0,1fr) 84px" }}>
                  <Isian label="Nama termin" style={{ fontWeight: 600 }} nilai={t.label}
                    onSimpan={(v) => !!v && ubah(t.id, { label: v })} />
                  <Isian label="Persen" inputMode="decimal" style={{ textAlign: "right" }} nilai={Number(t.persen).toLocaleString("id-ID")}
                    onSimpan={(v) => angka(v) > 0 && angka(v) <= 100 && ubah(t.id, { persen: angka(v) })} />
                </div>
                <div className="g2">
                  <label className="lbl">Jatuh tempo<input key={t.jatuh_tempo || ""} className="inp" type="date" defaultValue={t.jatuh_tempo || ""} onChange={(e) => ubah(t.id, { jatuh_tempo: e.target.value || null })} /></label>
                  <label className="lbl">Lunas tanggal
                    <input key={t.lunas_tgl || ""} className="inp" type="date" defaultValue={t.lunas_tgl || ""} max={hariIni()}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) ubah(t.id, { lunas_tgl: null, dibayar: null }, `Status lunas ${t.label} dibatalkan.`);
                        else if (t.lunas_tgl) ubah(t.id, { lunas_tgl: v });
                        else lunas(t, v);
                      }} />
                  </label>
                </div>
                <label className="lbl">Sudah diterima (boleh sebagian)
                  <InputRupiah nilai={t.dibayar}
                    onSimpan={(v) => ubah(
                      t.id,
                      // Pembayaran yang menutup tagihan sekaligus menandai termin lunas.
                      { dibayar: v, ...(v && n && !t.lunas_tgl && v >= tagihanTermin(t, nilai) ? { lunas_tgl: hariIni() } : {}) },
                      v ? `Pembayaran ${t.label} dicatat: ${rp(v)}` : `Pembayaran ${t.label} dikosongkan.`
                    )} />
                </label>
                <div className="row" style={{ alignItems: "center" }}>
                  <span className={n ? "num" : "small"}>{n ? `Tagihan ${rp(tagihanTermin(t, nilai))}` : `Tagihan muncul setelah ${jenis === "produksi" ? "harga item" : "nilai perancangan"} diisi`}</span>
                  {t.lunas_tgl ? <span className="badge b-ok">Lunas {tgl(t.lunas_tgl)}</span> : diterima > 0 ? <span className="badge b-warn">Sebagian</span> : null}
                </div>
                {t.lunas_tgl && t.dibayar == null && (
                  <p className="small" style={{ margin: 0 }}>
                    Nominal lunas belum dikunci, jadi masih mengikuti harga. {n ? "Ketuk “Kunci nominal” atau isi" : "Isi"} kolom “Sudah diterima” untuk menguncinya.
                  </p>
                )}
                <div className="acts">
                  {!t.lunas_tgl && (
                    <button type="button" className="act" disabled={aksi.sibuk} onClick={() => lunas(t, hariIni())}>Lunas hari ini</button>
                  )}
                  {t.lunas_tgl && t.dibayar == null && n > 0 && (
                    <button type="button" className="act" disabled={aksi.sibuk}
                      onClick={() => ubah(t.id, kunci(t), `Nominal ${t.label} dikunci: ${rp(tagihanTermin(t, nilai))}`)}>
                      Kunci nominal
                    </button>
                  )}
                  <button type="button" className="act bahaya" disabled={aksi.sibuk}
                    onClick={() => confirm(`Hapus termin "${t.label}"?`) && aksi.jalankan(() => A.hapusTermin(t.id), "Termin dihapus.")}>
                    Hapus
                  </button>
                </div>
              </div>
            );
          })}
          {/* Termin baru hanya bisa ditambah selama total persennya belum 100%. */}
          {total < 100 && (
            <button type="button" className="btn2" disabled={aksi.sibuk}
              onClick={() => aksi.jalankan(() => A.tambahTermin(proyek.id, [{
                jenis, urutan: termin.reduce((m, t) => Math.max(m, t.urutan), -1) + 1,
                label: `Termin ${termin.length + 1}`, persen: Math.round((100 - total) * 100) / 100,
              }]))}>
              + Tambah termin
            </button>
          )}
        </>
      )}
    </section>
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
        Klien membuka proyek lewat link rahasia, tanpa login. Satu proyek satu link, dan semua perubahan progres,
        item, dan termin langsung tampil di link yang sama. Siapa pun yang memegang link bisa melihat proyek ini,
        jadi kirim hanya ke klien. Cabut link kalau bocor atau tidak dipakai lagi.
      </p>
      {klien.length > 1 && (
        <p className="note b-warn">Proyek ini punya {klien.length} link. Cukup satu, cabut yang tidak dipakai.</p>
      )}
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
      {!klien.length && (
        <div className="card stack">
          <label className="lbl">Nama klien<input className="inp" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Bpk. Alfeus" /></label>
          <button type="button" className="btn" disabled={aksi.sibuk}
            onClick={() => aksi.jalankan(() => A.buatLink(proyek.id, nama), "Link dibuat. Salin atau kirim lewat WA.")}>
            Buat link klien
          </button>
        </div>
      )}
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
