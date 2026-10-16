"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAksi } from "../../useAksi";
import Pesan from "../../Pesan";
import UnggahBoq from "../../UnggahBoq";
import TabBar from "../../../TabBar";
import {
  FASE, JENIS_LABEL, tahapItem, persenItem, persenProyek,
  tahapTerakhir, tahapBerikut, tahapBar, areaProgres, faseKini, produksiSelesai, tahapTerkunci,
} from "@/lib/portal/progresBoq";
import {
  hariIni, tgl, tglTh, rp, pct, angka, tagihanTermin, dibayarTermin, totalDibayar, lewatDeadline, labelDeadline,
  JENIS_TERMIN, jenisTermin, nilaiTermin, totalNilai, terminStandar, judulTermin, keteranganTermin,
} from "@/lib/portal/format";
import { bacaBoq, bacaBaris, formatLama, bacaJasa, infoSheet } from "@/lib/portal/imporBoq";
import { bukaXlsx } from "@/lib/portal/bacaXlsx";
import * as A from "../../aksi";

const WARNA = { produksi: "var(--ph1)", pengiriman: "var(--ph2)", instalasi: "var(--ph3)", retensi: "var(--ph4)" };
const TABS = [["progres", "Progres"], ["item", "Jasa tukang"], ["termin", "Termin"], ["klien", "Klien"], ["info", "Info"]];
const TABS_TUKANG = [["progres", "Progres"], ["item", "Jasa tukang"]];

export default function AdminProyek({ proyek, items, termin, klien, supervisors, staf }) {
  const admin = staf.role === "ADMIN";
  // Tukang (akun MANDOR): hanya melihat item timnya, tanpa bisa mengubah apa pun.
  const tukang = staf.role === "TUKANG";
  const [tab, setTab] = useState("progres");
  const aksi = useAksi();
  const nilai = items.reduce((a, i) => a + (Number(i.harga) || 0), 0);
  const nilaiT = nilaiTermin({ ...proyek, items });
  const kunci = lewatDeadline(proyek);
  const [sisa, kelasSisa] = proyek.deadline ? labelDeadline(proyek.deadline) : [];

  return (
    <main className="wrap">
      <Link href="/portal" className="back">← Semua proyek</Link>
      <div>
        <div className="eb">{[proyek.kode, proyek.klien_nama].filter(Boolean).join(" · ")}</div>
        <h1>{proyek.nama}</h1>
        {proyek.lokasi && <div className="small lok">{proyek.lokasi}</div>}
        {proyek.deadline && (
          <div className="row" style={{ justifyContent: "flex-start", alignItems: "center", marginTop: 8 }}>
            <span className="small">Deadline {tglTh(proyek.deadline)}</span>
            <span className={`badge ${kelasSisa}`}>{sisa}</span>
          </div>
        )}
      </div>
      {kunci && !tukang && (
        <p className="note b-bad">
          Proyek sudah lewat deadline, jadi terkunci. Progres, item, termin, link klien, dan info proyek tidak bisa diubah lagi.
        </p>
      )}
      {/* Nilai kontrak hanya untuk master; supervisor cukup melihat progres. */}
      <div className="grid2" style={{ gridTemplateColumns: admin ? "minmax(0,5fr) minmax(0,7fr)" : "1fr" }}>
        <div className="stat lead">
          <div className="eb">Progres</div>
          <div className="v num">{pct(persenProyek(items))}</div>
          <div className="s">{items.length} item</div>
        </div>
        {admin && <div className="stat">
          <div className="eb">Nilai proyek</div>
          <div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.05rem)" }}>{totalNilai(nilaiT) ? rp(totalNilai(nilaiT)) : "—"}</div>
          <div className="s">
            {totalNilai(nilaiT) ? (nilai ? `jasa tukang ${rp(nilai)}` : "diisi di tab Termin") : "isi di tab Termin"}
          </div>
        </div>}
      </div>
      {/* Supervisor hanya punya tab Progres, jadi tidak perlu navigasi. */}
      {(admin || tukang) && <TabBar tabs={tukang ? TABS_TUKANG : TABS} value={tab} onChange={(k) => { setTab(k); aksi.setMsg(""); }} />}
      <Pesan aksi={aksi} />

      {/* Lewat deadline: semua isian & tombol dimatikan sekaligus lewat fieldset. Tab Klien
          di luar fieldset supaya link masih bisa disalin / dikirim; tombolnya diatur sendiri. */}
      {tukang ? (
        tab === "progres" ? <TabProgres proyek={proyek} items={items} aksi={aksi} admin={false} lihat /> : <JasaTukangLihat items={items} />
      ) : tab === "klien" ? (
        <TabKlien proyek={proyek} klien={klien} aksi={aksi} kunci={kunci} />
      ) : (
        <fieldset className="kunci" disabled={kunci}>
          {tab === "progres" && <TabProgres proyek={proyek} items={items} aksi={aksi} admin={admin} />}
          {tab === "item" && <TabItem proyek={proyek} items={items} aksi={aksi} />}
          {tab === "termin" && <TabTermin proyek={proyek} items={items} termin={termin} nilai={nilaiT} aksi={aksi} />}
          {tab === "info" && <TabInfo proyek={proyek} supervisors={supervisors} aksi={aksi} />}
        </fieldset>
      )}
      {/* Di luar fieldset: proyek yang terkunci tetap bisa dihapus. */}
      {admin && tab === "info" && <HapusProyek proyek={proyek} items={items} termin={termin} klien={klien} aksi={aksi} />}
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

/* ---------- Progres: satu ketukan untuk tahap berikutnya, buka item untuk semua tahap ---------- */
// Tahap selalu dicatat selesai hari ini (tanggalnya tidak bisa dipilih).
// `lihat` = hanya melihat (tukang): bar dan tombol tahap tidak bisa diketuk.
function TabProgres({ proyek, items, aksi, admin, lihat }) {
  const tanggal = hariIni();
  const [sisa, kelasSisa] = proyek.deadline ? labelDeadline(proyek.deadline) : [];
  const [buka, setBuka] = useState(null);
  const [busy, setBusy] = useState(null);
  const [tim, setTim] = useState(""); // "" = semua tim
  const [area, setArea] = useState(""); // "" = semua area
  items = items.filter((i) => areaProgres(i.area));
  const kunci = !!busy || aksi.sibuk || !!lihat;
  // Saring lewat dua dropdown (Tim, Area) supaya daftar item langsung terlihat
  // tanpa buka-tutup bertingkat. Item dikelompokkan per area dengan judul biasa.
  const TANPA_TIM = "Belum ada tim";
  const tims = [...new Set(items.map((i) => i.tim || TANPA_TIM))].sort((a, b) => (a === TANPA_TIM) - (b === TANPA_TIM));
  const adaTim = !lihat && items.some((i) => i.tim); // tukang hanya punya satu tim
  const diTim = items.filter((i) => !tim || (i.tim || TANPA_TIM) === tim);
  const areas = [...new Set(diTim.map((i) => i.area))];
  const tampil = diTim.filter((i) => !area || i.area === area);

  if (!items.length) return <div className="card small">Belum ada item. Admin perlu mengimpor item di tab Jasa tukang.</div>;

  async function toggle(it, s) {
    const batal = !!it.progres[s.k];
    setBusy(`${it.id}:${s.k}`);
    await aksi.jalankan(
      () => A.setProgres(it.id, s.k, batal ? null : tanggal),
      batal ? `${s.label} dibatalkan · ${it.nama}` : `${s.label} ✓ ${tgl(tanggal)} · ${it.nama}`
    );
    setBusy(null);
  }

  // Satu kartu item: nama, bar fase berjalan, dan (dibuka) semua tahap.
  const kartu = (it) => {
    const akhir = tahapTerakhir(it), next = tahapBerikut(it), open = buka === it.id;
    const fase = faseKini(it);
    // Fase berjalan saja; kalau semua selesai, tampilkan semua tahap (penuh).
    // Selama produksi belum selesai, tahap fase sesudahnya tidak tampil/tidak bisa dicatat.
    const bar = (fase ? tahapBar(it).filter((s) => s.fase === fase.k && s.w > 0) : tahapBar(it))
      .filter((s) => !tahapTerkunci(it, s));
    return (
      <div key={it.id} className={`item acc${open ? " open" : ""}`}>
        <button type="button" className="acc-h" aria-expanded={open} onClick={() => setBuka(open ? null : it.id)}>
          <span className="t">
            <span className="nm">{it.nama}</span>
            <span className="small">{[it.kode, JENIS_LABEL[it.jenis], !tim && it.tim].filter(Boolean).join(" · ")}</span>
          </span>
          <b className="num">{persenItem(it)}%</b>
          <i className="chev" aria-hidden="true" />
        </button>
        {/* Tiap bagian bar = satu tahap di fase berjalan; boleh dicentang tidak berurutan. */}
        <div className="track tap">
          {bar.map((s) => (
            <button key={s.k} type="button" className={it.progres[s.k] ? "on" : ""} disabled={kunci}
              style={{ flex: s.w, "--c": WARNA[s.fase], ...(busy === `${it.id}:${s.k}` ? { opacity: 0.5 } : null) }}
              title={it.progres[s.k] ? `${s.label} ✓ ${tgl(it.progres[s.k])}` : s.label}
              aria-label={it.progres[s.k] ? `Batalkan ${s.label}` : `Catat ${s.label}`} aria-pressed={!!it.progres[s.k]}
              onClick={() => toggle(it, s)} />
          ))}
        </div>
        {open ? (
          <TahapItem it={it} aksi={aksi} admin={admin} kunci={kunci} busy={busy} toggle={toggle} />
        ) : (
          <div className="acc-q">
            <span className="small">
              {fase && <b style={{ fontWeight: 600 }}>{fase.label} {pct(fase.persen)} · </b>}
              {akhir ? `${akhir.label} ✓ ${tgl(akhir.tgl)}` : "Belum mulai"}
            </span>
            {!next && <span className="badge b-ok">Selesai 100%</span>}
          </div>
        )}
      </div>
    );
  };
  return (
    <>
      {/* Pengingat deadline (hanya label, tidak bisa diubah). */}
      <div className="card tglrow" style={{ padding: "12px 14px" }}>
        <span>Deadline</span>
        {proyek.deadline ? (
          <span className="row" style={{ alignItems: "center", textTransform: "none", letterSpacing: 0 }}>
            <b className="num" style={{ fontSize: ".9rem", color: "var(--fg)" }}>{tglTh(proyek.deadline)}</b>
            <span className={`badge ${kelasSisa}`}>{sisa}</span>
          </span>
        ) : (
          <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>Belum ditetapkan</span>
        )}
      </div>
      <p className="small" style={{ margin: 0 }}>
        {lihat
          ? "Progres dicatat oleh supervisor. Ketuk nama item untuk melihat semua tahap."
          : "Ketuk bagian bar untuk mencatat tahap fase berjalan, ketuk lagi untuk membatalkan. Ketuk nama item untuk semua tahap."}
      </p>
      <div className="card" style={{ padding: "10px 14px" }}>
        <div className="g2" style={adaTim ? null : { gridTemplateColumns: "1fr" }}>
          {adaTim && (
            <label className="lbl">Tim
              <select className="inp" value={tim} onChange={(e) => { setTim(e.target.value); setArea(""); }}>
                <option value="">Semua tim</option>
                {tims.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          )}
          <label className="lbl">Area
            <select className="inp" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">Semua area</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>
        <div className="row small" style={{ marginTop: 10 }}>
          <span>{tampil.length} item{tim || area ? " tersaring" : ""}</span>
          <b className="num">{pct(persenProyek(tampil))}</b>
        </div>
        <span className="bar" style={{ display: "block", marginTop: 6 }}><i style={{ width: `${persenProyek(tampil)}%` }} /></span>
      </div>
      {areas.filter((a) => !area || a === area).map((a) => {
        const its = tampil.filter((i) => i.area === a);
        return (
          <div key={a} className="stack" style={{ gap: 8 }}>
            <div className="area"><h2>{a}</h2><span className="num small">{pct(persenProyek(its))} · {its.length} item</span></div>
            {its.map(kartu)}
          </div>
        );
      })}
    </>
  );
}

// Semua tahap satu item per fase: tombol centang, dan (master) slider bobot
// langsung di bawah tiap tahap. Bobot khusus item ini saja. Tiap slider berdiri
// sendiri (tahap lain tidak ikut berubah); total tidak harus 100 karena progres
// item dihitung dari perbandingan bobotnya.
function TahapItem({ it, aksi, admin, kunci, busy, toggle }) {
  const tahap = tahapItem(it);
  const awal = Object.fromEntries(tahap.map((s) => [s.k, s.w]));
  const kunciAwal = JSON.stringify(awal);
  const [b, setB] = useState(awal);
  useEffect(() => setB(JSON.parse(kunciAwal)), [kunciAwal]);
  const berubah = tahap.some((s) => b[s.k] !== s.w);
  const total = tahap.reduce((a, s) => a + b[s.k], 0);
  const geser = (k, v) => setB({ ...b, [k]: v });
  const terkunci = !produksiSelesai(it);

  return (
    <div className="acc-b">
      {FASE.map((f) => {
        const st = tahap.filter((s) => s.fase === f.k);
        // Fase sesudah produksi: supervisor tidak melihatnya sama sekali; master
        // tetap melihat (untuk mengatur bobot) tapi tombol catatnya terkunci.
        const tutup = terkunci && f.k !== "produksi";
        if (!st.length || (tutup && !admin)) return null;
        return (
          <div key={f.k}>
            <div className="fl">{f.label}{tutup && " · terkunci"}</div>
            <div className="pills">
              {st.map((s) => (
                <div key={s.k} className="tahap-sel">
                  <button type="button" className="pill" aria-pressed={!!it.progres[s.k]}
                    disabled={kunci || tutup} style={busy === `${it.id}:${s.k}` ? { opacity: 0.5 } : null}
                    onClick={() => toggle(it, s)}>
                    <span>{it.progres[s.k] ? "✓ " : ""}{s.label}</span>
                    <span className="w">{it.progres[s.k] ? tgl(it.progres[s.k]) : `${b[s.k]}%`}</span>
                  </button>
                  {admin && (
                    <label className="geser mini">
                      <input type="range" min="0" max="100" step="1" value={b[s.k]} aria-label={`Bobot ${s.label}`}
                        style={{ accentColor: WARNA[s.fase] }} onChange={(e) => geser(s.k, Number(e.target.value))} />
                      <b className="num">{b[s.k]}%</b>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {terkunci && tahap.some((s) => s.fase !== "produksi") && (
        <p className="small" style={{ margin: 0 }}>Pengiriman dan instalasi terbuka setelah semua tahap produksi selesai.</p>
      )}
      {admin && (berubah || it.bobot_khusus) && (
        <div className="stack" style={{ gap: 8 }}>
          <p className="small" style={{ margin: 0 }}>
            Total bobot <b className="num">{total.toLocaleString("id-ID")}</b>
            {total !== 100 && " · tidak harus 100, progres item tetap dihitung 0–100% dari perbandingannya"}.
            {!berubah && " Item ini memakai bobot khusus (bukan bobot bawaan jenisnya)."}
          </p>
          <div className="acts">
            {berubah && (
              <>
                <button type="button" className="act" disabled={aksi.sibuk || total <= 0}
                  onClick={() => aksi.jalankan(() => A.simpanBobotItem(it.id, b), `Bobot tahap ${it.nama} disimpan.`)}>
                  Simpan bobot
                </button>
                <button type="button" className="act" onClick={() => setB(awal)}>Batal</button>
              </>
            )}
            {it.bobot_khusus && !berubah && (
              <button type="button" className="act" disabled={aksi.sibuk}
                onClick={() => confirm(`Kembalikan bobot ${it.nama} ke bobot bawaan jenisnya?`) &&
                  aksi.jalankan(() => A.simpanBobotItem(it.id, null), `Bobot ${it.nama} kembali ke bawaan.`)}>
                Kembali ke bawaan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Jasa tukang (item BOQ): edit, tambah, impor ---------- */
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

function TabItem({ proyek, items, aksi }) {
  const [buka, setBuka] = useState(null);
  // `ok` = pesan hijau setelah tersimpan.
  const ubah = (id, patch, ok) => aksi.jalankan(() => A.ubahItem(id, patch), ok);
  const areas = [...new Set(items.map((i) => i.area))];
  const urutan = items.reduce((m, i) => Math.max(m, i.urutan), -1) + 1; // untuk item baru
  const tims = [...new Set(items.map((i) => i.tim).filter(Boolean))];

  return (
    <>
      <datalist id="daftar-area">{areas.map((a) => <option key={a} value={a} />)}</datalist>
      <datalist id="daftar-tim">{tims.map((t) => <option key={t} value={t} />)}</datalist>
      <RingkasJasa items={items} />

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
                      {[it.kode, teksQty(it), it.dimensi, it.harga_satuan && `@ ${rp(it.harga_satuan)}`, it.tim].filter(Boolean).join(" · ")}
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
                    <div className="g2">
                      <label className="lbl">Harga satuan
                        <InputRupiah nilai={it.harga_satuan}
                          onSimpan={(v) => ubah(it.id, { harga_satuan: v }, v ? `Harga satuan ${it.nama} disimpan: ${rp(v)}` : `Harga satuan ${it.nama} dikosongkan.`)} />
                      </label>
                      <label className="lbl">Total
                        <InputRupiah nilai={it.harga}
                          onSimpan={(v) => ubah(it.id, { harga: v }, v ? `Total jasa ${it.nama} disimpan: ${rp(v)}` : `Total jasa ${it.nama} dikosongkan.`)} />
                      </label>
                    </div>
                    <Isian label="Tim tukang" nilai={it.tim} list="daftar-tim" placeholder="mis. Mas Alan"
                      onSimpan={(v) => ubah(it.id, { tim: v || null }, v ? `${it.nama} dikerjakan tim ${v}.` : `Tim ${it.nama} dikosongkan.`)} />
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

      <ImporJasa proyek={proyek} items={items} aksi={aksi} />
      <TambahItem proyek={proyek} areas={areas} urutan={urutan} aksi={aksi} />
      <ImporBoq proyek={proyek} items={items} urutan={urutan} aksi={aksi} />
    </>
  );
}

// Total jasa tukang semua item, dipecah per tim.
function RingkasJasa({ items }) {
  const total = items.reduce((a, i) => a + (Number(i.harga) || 0), 0);
  const perTim = {};
  for (const i of items) if (Number(i.harga) > 0) perTim[i.tim || "Belum ada tim"] = (perTim[i.tim || "Belum ada tim"] || 0) + Number(i.harga);
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <h3>Total jasa tukang</h3>
        <b className="num">{total ? rp(total) : "—"}</b>
      </div>
      {Object.entries(perTim).map(([t, n]) => (
        <div key={t} className="row small"><span>{t}</span><span className="num">{rp(n)}</span></div>
      ))}
    </div>
  );
}

// Jasa tukang untuk tukang: hanya total per item (harga satuan tidak dikirim
// dari server), tanpa isian apa pun.
function JasaTukangLihat({ items }) {
  const areas = [...new Set(items.map((i) => i.area))];
  return (
    <>
      <RingkasJasa items={items} />
      {areas.map((a) => (
        <div key={a} className="stack" style={{ gap: 8 }}>
          <div className="area"><h2>{a}</h2></div>
          {items.filter((i) => i.area === a).map((it) => (
            <div key={it.id} className="item acc">
              <div className="acc-h">
                <span className="t">
                  <span className="nm">{it.nama}</span>
                  <span className="small">{[it.kode, teksQty(it), it.dimensi].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="num small">{it.harga ? rp(it.harga) : "—"}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

// Impor Excel "Hitungan Jasa Pekerjaan" (satu sheet per tim): harga satuan dan
// total masuk ke item proyek yang nama + kodenya sama. Baris tambahan (ambalan,
// LED, stopkontak) dilewati; item yang tidak ada di proyek ditampilkan saja.
const kunciNama = (i) => (i.nama || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function cocokkanJasa(rows, items) {
  const dipakai = new Set();
  return rows.map((r) => {
    const sama = (i) => !dipakai.has(i.id) && kunciNama(i) === kunciNama(r);
    const it = items.find((i) => sama(i) && (i.kode || "") === (r.kode || "")) || items.find(sama);
    if (it) dipakai.add(it.id);
    return { ...r, item: it || null };
  });
}

// Satu file bisa berisi beberapa sheet (satu per tim, mis. Mas Alan & Pak
// Ndan): semua sheet yang berisi item jasa bisa dicentang sekaligus dan
// digabung jadi satu impor; tim tiap baris diambil dari sheet asalnya.
function ImporJasa({ proyek, items, aksi }) {
  const [buku, setBuku] = useState(null); // { sheets: [{ nama, rows, tim }] }
  const [pilih, setPilih] = useState({}); // { [sheet]: true/false }
  const [tim, setTim] = useState({}); // { [sheet]: nama tim }
  const [galat, setGalat] = useState("");
  const [unggahKe, setUnggahKe] = useState(0); // ganti key = kosongkan pilihan file
  const hasil = useMemo(() => {
    if (!buku) return [];
    const baris = buku.sheets.filter((x) => pilih[x.nama]).flatMap((x) => x.rows.map((r) => ({ ...r, sheet: x.nama })));
    return cocokkanJasa(baris, items);
  }, [buku, pilih, items]);
  const cocok = hasil.filter((r) => r.item);
  const timBaris = (r) => (tim[r.sheet] || "").trim() || null;

  async function pilihFile(e) {
    const file = e.target.files?.[0];
    setGalat("");
    setBuku(null);
    aksi.setMsg("");
    if (!file) return;
    try {
      const b = bukaXlsx(await file.arrayBuffer());
      const sheets = b.sheets
        .map((nama) => { const rows = b.baca(nama); return { nama, rows: bacaJasa(rows), tim: infoSheet(rows).tim || "" }; })
        .filter((x) => x.rows.length);
      if (!sheets.length) throw new Error("kosong");
      setBuku({ sheets });
      setPilih(Object.fromEntries(sheets.map((x) => [x.nama, true])));
      setTim(Object.fromEntries(sheets.map((x) => [x.nama, x.tim])));
    } catch (err) {
      setGalat(err.message === "kosong"
        ? "Tidak ada item jasa yang terbaca. Pastikan ini file Hitungan Jasa Pekerjaan."
        : "File tidak bisa dibaca. Pastikan formatnya Excel .xlsx (bukan .xls atau PDF).");
    }
  }

  async function simpan() {
    const tims = [...new Set(cocok.map(timBaris).filter(Boolean))];
    const ok = await aksi.jalankan(
      () => A.simpanJasaTukang(proyek.id, cocok.map((r) => ({ id: r.item.id, harga_satuan: r.harga_satuan, harga: r.harga, tim: timBaris(r) }))),
      `Jasa tukang ${cocok.length} item disimpan${tims.length ? ` (tim ${tims.join(", ")})` : ""}.`
    );
    if (!ok) return;
    setBuku(null);
    setUnggahKe((n) => n + 1);
  }

  return (
    <div className="card stack">
      <h3>Impor jasa tukang dari Excel</h3>
      <div className="stack">
        <p className="small" style={{ margin: 0 }}>
          Untuk file <b>Hitungan Jasa Pekerjaan</b>. Pilih file, lalu centang sheet tim yang mau dimasukkan (boleh lebih dari satu, digabung jadi satu impor).
          Harga satuan dan total tiap item bernomor masuk ke item proyek yang namanya sama. Baris tambahan seperti
          ambalan, LED strip, dan stopkontak dilewati.
        </p>
        <label className="lbl">File hitungan jasa (.xlsx)
          <input key={unggahKe} className="inp" type="file" style={{ padding: "9px 12px" }} onChange={pilihFile}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
        </label>
        {galat && <p className="note b-bad">{galat}</p>}
        {buku && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="fl" style={{ margin: 0 }}>Sheet ({buku.sheets.length})</div>
            {buku.sheets.map((x) => (
              <div key={x.nama} className="g2" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", alignItems: "end" }}>
                <label className="cek" style={{ minWidth: 0 }}>
                  <input type="checkbox" checked={!!pilih[x.nama]} onChange={(e) => setPilih({ ...pilih, [x.nama]: e.target.checked })} />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{x.nama} · {x.rows.length} item</span>
                </label>
                <input className="inp" list="daftar-tim" aria-label={`Tim untuk ${x.nama}`} placeholder="Tim tukang"
                  value={tim[x.nama] || ""} onChange={(e) => setTim({ ...tim, [x.nama]: e.target.value })} />
              </div>
            ))}
          </div>
        )}
        {hasil.length > 0 && (
          <>
            <div>
              {hasil.map((r, n) => (
                <div key={n} className={`pv${r.item ? "" : " off"}`} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <span className="t">
                    <span className="nm">{r.nama}{r.kode ? ` (${r.kode})` : ""}</span>
                    <span className="small">
                      {[`${Number(r.qty).toLocaleString("id-ID")} × ${r.harga_satuan ? rp(r.harga_satuan) : "—"}`, timBaris(r),
                        r.item ? `ke ${r.item.area}` : "tidak ada di proyek ini, dilewati"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <b className="num small">{r.harga != null ? rp(r.harga) : "—"}</b>
                </div>
              ))}
            </div>
            <div className="row small">
              <span>Total {cocok.length} item</span>
              <b className="num">{rp(cocok.reduce((a, r) => a + (Number(r.harga) || 0), 0))}</b>
            </div>
          </>
        )}
        {buku && (
          <button type="button" className="btn" disabled={aksi.sibuk || !cocok.length} onClick={simpan}>
            Simpan jasa {cocok.length} item
          </button>
        )}
      </div>
    </div>
  );
}

function TambahItem({ proyek, areas, urutan, aksi }) {
  const kosong = { area: areas[areas.length - 1] || "", nama: "", kode: "", jenis: "HPL", qty: "1", satuan: "unit", dimensi: "", harga_satuan: null, harga: null, tim: "" };
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
          satuan: f.satuan.trim() || null, dimensi: f.dimensi.trim() || null, harga_satuan: f.harga_satuan, harga: f.harga,
          tim: f.tim.trim() || null, bobot: 1, urutan,
        }]), `${nama} ditambahkan.`);
        // Area dan tim dipertahankan untuk item berikutnya.
        if (ok) setF({ ...kosong, area: f.area, tim: f.tim });
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
        <div className="g2">
          <label className="lbl">Harga satuan
            <InputRupiah nilai={f.harga_satuan} onSimpan={(v) => setF((x) => ({ ...x, harga_satuan: v }))} />
          </label>
          <label className="lbl">Total
            <InputRupiah nilai={f.harga} onSimpan={(v) => setF((x) => ({ ...x, harga: v }))} />
          </label>
        </div>
        <label className="lbl">Tim tukang<input className="inp" list="daftar-tim" value={f.tim} onChange={set("tim")} placeholder="mis. Mas Alan" /></label>
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
  const preview = useMemo(() => (file ? bacaBaris(file.rows, urutan) : teks ? bacaBoq(teks, urutan) : []), [file, teks, urutan]);
  const sudahAda = useMemo(() => new Set(items.map(kunciItem)), [items]);

  // Saat menambah, baris yang sudah ada di proyek tidak dicentang (impor dua kali tidak menggandakan).
  const kembar = (p) => !ganti && sudahAda.has(kunciItem(p));
  const dipakai = (p, n) => centang[n] ?? !kembar(p);
  const terpilih = preview.filter((p, n) => dipakai(p, n));
  const nKembar = preview.filter(kembar).length;
  const nProgres = items.reduce((a, i) => a + Object.keys(i.progres).length, 0);
  const areaPv = [...new Set(preview.map((p) => p.area))];
  const sumberBaru = () => setCentang({});

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
    <details className="lipat">
      <summary><b>Impor item BOQ dari Excel</b></summary>
      <div className="lipat-b" style={{ gap: 12 }}>
      <p className="small" style={{ margin: 0 }}>
        Untuk menambah atau mengganti <b>daftar item</b> dari file <b>BoQ</b> (bukan file jasa tukang). Pilih file, lalu sheet proyeknya. Yang diambil hanya item bernomor (kabinet, wardrobe, dll.)
        beserta area, kode, dimensi, dan qty-nya; aksesoris tanpa nomor seperti LED, handle, dan stopkontak dilewati.
        Nilai jasa tukang diisi setelah impor.
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
            Hilangkan centang untuk melewati baris.
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
    </details>
  );
}

/* ---------- Termin ---------- */
// Termin jasa produksi, dari nilai proyek (terpisah dari nilai jasa tukang). Persennya berjumlah 100%.
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
  const lunas = (t, nama, tanggal) => ubah(t.id, { lunas_tgl: tanggal, ...kunci(t) }, `${nama} lunas ${tgl(tanggal)}.`);
  const standar = polaPersen(terminStandar().map(([, p]) => p));
  const sesuai = polaPersen(termin.map((t) => t.persen)) === standar;
  const adaBayar = termin.some((t) => t.lunas_tgl || Number(t.dibayar) > 0);
  const buatStandar = () =>
    aksi.jalankan(() => A.buatTerminStandar(proyek.id, jenis), `Termin ${judul.toLowerCase()} dibuat (${standar}).`);
  const aturan = "DP 50%, 40% saat progres 50%, pelunasan 10%.";

  return (
    <section className="stack">
      <div className="row" style={{ marginTop: 6 }}>
        <h2>{judul}</h2>
        <span className="small num">progres {pct(progres)}</span>
      </div>
      {/* Nilai proyek ke klien: dasar tagihan tiap termin, terpisah dari nilai jasa tukang. */}
      <label className="lbl">Nilai proyek
        <InputRupiah nilai={proyek.nilai_proyek}
          onSimpan={(v) => aksi.jalankan(() => A.ubahProyek(proyek.id, { nilai_proyek: v }),
            v ? `Nilai proyek disimpan: ${rp(v)}.` : "Nilai proyek dikosongkan.")} />
      </label>
      <p className="small" style={{ margin: 0 }}>Aturan: {aturan}</p>

      {!termin.length ? (
        <div className="card stack" style={{ textAlign: "center" }}>
          <p className="small" style={{ margin: 0 }}>Belum ada jadwal termin.</p>
          <button type="button" className="btn" disabled={aksi.sibuk} onClick={buatStandar}>
            Buat termin standar ({standar})
          </button>
        </div>
      ) : (
        <>
          {total !== 100 && (
            <p className="note b-warn">
              Total persen termin {total.toLocaleString("id-ID")}%, {total < 100 ? `kurang ${(100 - total).toLocaleString("id-ID")}%` : `lebih ${(total - 100).toLocaleString("id-ID")}%`} dari 100%.
            </p>
          )}
          {!sesuai && (
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
          {/* Tiap termin satu kartu; judulnya otomatis Termin 1, 2, 3, ... sesuai urutan. */}
          {termin.map((t, i) => {
            const diterima = dibayarTermin(t, nilai);
            const nama = judulTermin(i);
            return (
              <div key={t.id} className="item">
                <h3>{nama}</h3>
                <div className="g2" style={{ gridTemplateColumns: "minmax(0,1fr) 84px" }}>
                  <Isian label="Keterangan" placeholder="mis. DP, saat progres 50%" nilai={keteranganTermin(t)}
                    onSimpan={(v) => ubah(t.id, { label: v })} />
                  <Isian label="Persen" inputMode="decimal" style={{ textAlign: "right" }} nilai={Number(t.persen).toLocaleString("id-ID")}
                    onSimpan={(v) => angka(v) > 0 && angka(v) <= 100 && ubah(t.id, { persen: angka(v) })} />
                </div>
                <div className="row" style={{ alignItems: "center" }}>
                  <span className={n ? "num" : "small"}>{n ? `Tagihan ${rp(tagihanTermin(t, nilai))}` : "Tagihan muncul setelah nilai proyek diisi"}</span>
                  {t.lunas_tgl ? <span className="badge b-ok">Lunas {tgl(t.lunas_tgl)}</span> : diterima > 0 ? <span className="badge b-warn">Sebagian</span> : null}
                </div>
                {t.lunas_tgl && t.dibayar == null && (
                  <p className="small" style={{ margin: 0 }}>
                    Nominal lunas belum dikunci, jadi masih mengikuti nilai proyek.{n ? " Ketuk “Kunci nominal” untuk menguncinya." : ""}
                  </p>
                )}
                <div className="acts">
                  {!t.lunas_tgl ? (
                    <button type="button" className="act" disabled={aksi.sibuk} onClick={() => lunas(t, nama, hariIni())}>Lunas hari ini</button>
                  ) : (
                    <button type="button" className="act" disabled={aksi.sibuk}
                      onClick={() => confirm(`Batalkan status lunas ${nama}?`) && ubah(t.id, { lunas_tgl: null, dibayar: null }, `Status lunas ${nama} dibatalkan.`)}>
                      Batalkan lunas
                    </button>
                  )}
                  {t.lunas_tgl && t.dibayar == null && n > 0 && (
                    <button type="button" className="act" disabled={aksi.sibuk}
                      onClick={() => ubah(t.id, kunci(t), `Nominal ${nama} dikunci: ${rp(tagihanTermin(t, nilai))}`)}>
                      Kunci nominal
                    </button>
                  )}
                  <button type="button" className="act bahaya" disabled={aksi.sibuk}
                    onClick={() => confirm(`Hapus ${nama}? Termin sesudahnya ikut bergeser nomornya.`) && aksi.jalankan(() => A.hapusTermin(t.id), "Termin dihapus.")}>
                    Hapus
                  </button>
                </div>
              </div>
            );
          })}
          {/* Termin baru otomatis bernomor berikutnya dan mendapat sisa persen sampai 100%. */}
          <button type="button" className="btn2" disabled={aksi.sibuk || total >= 100}
            onClick={() => aksi.jalankan(() => A.tambahTermin(proyek.id, [{
              jenis, urutan: termin.reduce((m, t) => Math.max(m, t.urutan), -1) + 1,
              label: "", persen: Math.round((100 - total) * 100) / 100,
            }]), `${judulTermin(termin.length)} ditambahkan.`)}>
            + Tambah {judulTermin(termin.length)}
          </button>
          {total >= 100 && (
            <p className="small" style={{ margin: 0 }}>
              Total persen sudah 100%. Kurangi persen termin lain dulu untuk menambah {judulTermin(termin.length)}.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- Link klien ---------- */
function TabKlien({ proyek, klien, aksi, kunci }) {
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
        jadi kirim hanya ke klien. Hapus link kalau bocor atau tidak dipakai lagi.
      </p>
      {klien.length > 1 && (
        <p className="note b-warn">Proyek ini punya {klien.length} link. Cukup satu, hapus yang tidak dipakai.</p>
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
            {!kunci && (
              <button type="button" className="act bahaya" disabled={aksi.sibuk}
                onClick={() => confirm(`Hapus link ${k.nama || ""}? Link ini tidak bisa dibuka lagi.`) && aksi.jalankan(() => A.cabutLink(k.id), "Link dihapus.")}>
                Hapus
              </button>
            )}
          </div>
        </div>
      ))}
      {!klien.length && !kunci && (
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
        mulai: f.mulai, supervisor_id: f.supervisor_id || null, aktif: f.aktif,
        ...(proyek.deadline ? {} : { deadline: f.deadline || null }),
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
        {/* Deadline hanya bisa diisi sekali; setelah tersimpan tidak bisa diubah. */}
        <label className="lbl">Deadline
          <input className="inp" type="date" value={f.deadline} onChange={set("deadline")} disabled={!!proyek.deadline} min={f.mulai} />
        </label>
      </div>
      <p className="small" style={{ margin: 0 }}>
        {proyek.deadline
          ? "Deadline sudah ditetapkan dan tidak bisa diubah. Setelah lewat deadline, proyek terkunci."
          : "Deadline hanya bisa diisi sekali dan tidak bisa diubah setelah disimpan."}
      </p>
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

// Hapus permanen. Tombol baru aktif setelah nama proyek diketik persis.
// Tidak lewat aksi.jalankan: setelah berhasil, halaman ini sudah tidak ada
// (refresh akan 404), jadi langsung pindah ke daftar proyek.
function HapusProyek({ proyek, items, termin, klien, aksi }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [ketik, setKetik] = useState("");
  const [busy, setBusy] = useState(false);
  const cocok = ketik.trim() === proyek.nama.trim();
  const ikut = [
    items.length && `${items.length} item beserta progresnya`,
    termin.length && `${termin.length} termin`,
    klien.length && "link klien (tidak bisa dibuka lagi)",
  ].filter(Boolean);

  async function hapus() {
    setBusy(true);
    aksi.setMsg("");
    let error;
    try {
      ({ error } = (await A.hapusProyek(proyek.id, ketik)) || {});
    } catch {
      error = "tidak tersambung ke server. Periksa koneksi lalu coba lagi.";
    }
    if (error) {
      setBusy(false);
      return aksi.setMsg(`Gagal: ${error}`);
    }
    router.replace("/portal");
    router.refresh();
  }

  if (!buka)
    return (
      <button type="button" className="act bahaya" style={{ alignSelf: "flex-start" }} onClick={() => setBuka(true)}>
        Hapus proyek
      </button>
    );
  return (
    <div className="card stack" style={{ borderColor: "var(--bad)" }}>
      <b style={{ color: "var(--bad)" }}>Hapus proyek ini?</b>
      <p className="small" style={{ margin: 0 }}>
        Proyek dihapus permanen dan tidak bisa dikembalikan.
        {ikut.length ? ` Ikut terhapus: ${ikut.join(", ")}.` : ""}
      </p>
      <label className="lbl">Ketik <b style={{ textTransform: "none", letterSpacing: 0 }}>{proyek.nama}</b> untuk konfirmasi
        <input className="inp" value={ketik} onChange={(e) => setKetik(e.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <div className="acts">
        <button type="button" className="act" disabled={busy} onClick={() => { setBuka(false); setKetik(""); }}>Batal</button>
        <button type="button" className="act bahaya" disabled={!cocok || busy} onClick={hapus}>
          {busy ? "Menghapus…" : "Hapus permanen"}
        </button>
      </div>
    </div>
  );
}
