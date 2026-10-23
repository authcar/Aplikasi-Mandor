"use client";
import KotaGlow from "./KotaGlow";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAksi } from "../../useAksi";
import Pesan from "../../Pesan";
import UnggahBoq from "../../UnggahBoq";
import FotoItem from "../../../FotoItem";
import FotoProgres, { FotoWajib } from "./FotoProgres";
import Mingguan from "./Mingguan";
import { unggahFotoItem } from "@/lib/portal/unggahFotoItem";
import TabBar from "../../../TabBar";
import {
  FASE, JENIS_LABEL, tahapItem, persenItem, persenProyek,
  tahapTerakhir, tahapBerikut, tahapBar, itemProgres, faseKini, faseTerkunci, tahapTerkunci, persenTahap, tahapSelesai,
} from "@/lib/portal/progresBoq";
import {
  hariIni, tgl, tglTh, rp, pct, angka, tagihanTermin, dibayarTermin, totalDibayar, lewatDeadline, labelDeadline, statusProyek,
  JENIS_TERMIN, jenisTermin, nilaiTermin, totalNilai, terminStandar, judulTermin, keteranganTermin, STATUS_DEFECT, DEFECT_AKTIF,
} from "@/lib/portal/format";
import { bacaBoq, bacaItemSheet, formatLama } from "@/lib/portal/imporBoq";
import * as A from "../../aksi";
import { kompresBanyakGambar, kompresGambar } from "@/lib/gambar";

const WARNA = { produksi: "var(--ph1)", pengiriman: "var(--ph2)", instalasi: "var(--ph3)", retensi: "var(--ph4)" };
const tanpaDefect = (tabs) => (DEFECT_AKTIF ? tabs : tabs.filter(([k]) => k !== "defect"));
const TABS = tanpaDefect([["progres", "Progres"], ["defect", "Defect"], ["item", "Jasa tukang"], ["termin", "Termin"], ["info", "Info"]]);
const TABS_SPV = tanpaDefect([["progres", "Progres"], ["mingguan", "Laporan mingguan"], ["defect", "Defect"]]);
const TABS_TUKANG = [["progres", "Progres"], ["item", "Jasa tukang"]];

export default function AdminProyek({ proyek, items, termin, addon = [], klien, supervisors, defect = [], mandor = null, staf, fotoProgres = [], riwayat = [] }) {
  const admin = staf.role === "ADMIN";
  // Tukang (akun MANDOR): hanya melihat item timnya, tanpa bisa mengubah apa pun.
  const tukang = staf.role === "TUKANG";
  const [tab, setTab] = useState("progres");
  const aksi = useAksi();
  const nilai = items.reduce((a, i) => a + (Number(i.harga) || 0), 0);
  const nilaiT = nilaiTermin({ ...proyek, items });
  const totalAddon = addon.reduce((a, x) => a + x.nilai, 0);
  const nilaiProyek = totalNilai(nilaiT) + totalAddon; // nilai proyek + addon
  const kunci = lewatDeadline(proyek);
  const [sisa, kelasSisa] = proyek.deadline ? labelDeadline(proyek.deadline) : [];
  const [status, kelasStatus] = statusProyek({ ...proyek, items });

  return (
    <main className="wrap">
      <Link href="/portal" className="back">← Semua proyek</Link>
      <div>
        <div className="eb">{[proyek.kode, proyek.klien_nama].filter(Boolean).join(" · ")}</div>
        <h1>{proyek.nama}</h1>
        {proyek.lokasi && <div className="small lok">{proyek.lokasi}</div>}
        <div className="row" style={{ justifyContent: "flex-start", alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <span className={`badge ${kelasStatus}`}>{status}</span>
          {proyek.deadline ? (
            <>
              <span className="small">Deadline {tglTh(proyek.deadline)}</span>
              <span className={`badge ${kelasSisa}`}>{sisa}</span>
            </>
          ) : (
            <span className="badge b-bad">Perlu input deadline</span>
          )}
        </div>
      </div>
      {kunci && !tukang && (
        <p className="note b-bad">
          Proyek sudah lewat deadline, jadi terkunci. Progres, item, termin, link klien, dan info proyek tidak bisa diubah lagi.
        </p>
      )}
      {/* Nilai kontrak hanya untuk master; supervisor cukup melihat progres. */}
      <div className="grid2" style={{ gridTemplateColumns: admin || tukang ? "minmax(0,5fr) minmax(0,7fr)" : "1fr" }}>
        <div className="stat lead">
          <KotaGlow />
          <div className="eb">Progres</div>
          <div className="v num">{pct(persenProyek(items))}</div>
          <div className="s">{items.length} item</div>
        </div>
        {tukang && <KartuJasaSaya items={items} />}
        {admin && <div className="stat">
          <div className="eb">Nilai proyek</div>
          <div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.05rem)" }}>{nilaiProyek ? rp(nilaiProyek) : "—"}</div>
          <div className="s">
            {nilaiProyek ? (totalAddon ? `termasuk addon ${rp(totalAddon)}` : nilai ? `jasa tukang ${rp(nilai)}` : "diisi di tab Termin") : "isi di tab Termin"}
          </div>
        </div>}
      </div>
      {/* Angka di tab Defect = defect BARU yang belum ditanggapi. */}
      <TabBar
        tabs={(tukang ? TABS_TUKANG : admin ? TABS : TABS_SPV).map(([k, l]) => [k, l, k === "defect" ? defect.filter((d) => d.status === "BARU").length : 0])}
        value={tab} onChange={(k) => { setTab(k); aksi.setMsg(""); }} />
      <Pesan aksi={aksi} />

      <div key={tab} className="tab-isi">
      {/* Lewat deadline: semua isian & tombol dimatikan sekaligus lewat fieldset. Tab Defect
          di luar fieldset (juga tombol link klien di tab Info, berupa <a>): link masih bisa disalin / dikirim, dan keluhan klien
          sering datang setelah serah terima. */}
      {tukang ? (
        tab === "progres" ? <TabProgres proyek={proyek} items={items} aksi={aksi} admin={false} lihat fotoProgres={fotoProgres} />
          : <JasaTukangLihat items={items} proyek={proyek} riwayat={riwayat} />
      ) : tab === "mingguan" ? (
        // Laporan hanya dibaca, jadi tetap bisa dibuka setelah proyek terkunci.
        <Mingguan proyek={proyek} items={items} riwayat={riwayat} />
      ) : tab === "defect" ? (
        <TabDefect items={items} defect={defect} aksi={aksi} admin={admin} mandor={mandor} />
      ) : (
        <>
        {tab === "item" && <UpahMingguan proyek={proyek} items={items} riwayat={riwayat} />}
        <fieldset className="kunci" disabled={kunci}>
          {tab === "progres" && <TabProgres proyek={proyek} items={items} aksi={aksi} admin={admin} fotoProgres={fotoProgres} />}
          {tab === "item" && <TabItem proyek={proyek} items={items} aksi={aksi} />}
          {tab === "termin" && <TabTermin proyek={proyek} items={items} termin={termin} addon={addon} nilai={nilaiT} aksi={aksi} />}
          {tab === "info" && <TabInfo proyek={proyek} supervisors={supervisors} klien={klien} kunci={kunci} aksi={aksi} />}
        </fieldset>
        </>
      )}
      {/* Di luar fieldset: proyek yang terkunci tetap bisa dihapus. */}
      {admin && tab === "info" && <HapusProyek proyek={proyek} items={items} termin={termin} klien={klien} aksi={aksi} />}
      </div>
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
// Tahap selalu dicatat hari ini (tanggalnya tidak bisa dipilih). Tiap tahap punya
// persen pengerjaan: centang = 100%, slider/ketik untuk sebagian (mis. Potong 10%).
// `lihat` = hanya melihat (tukang): bar, tombol, dan slider tahap tidak bisa diubah.
function TabProgres({ proyek, items: itemsAsli, aksi, admin, lihat, fotoProgres = [] }) {
  const tanggal = hariIni();
  const [sisa, kelasSisa] = proyek.deadline ? labelDeadline(proyek.deadline) : [];
  const [buka, setBuka] = useState(null);
  const [busy, setBusy] = useState(null);
  const [tim, setTim] = useState(""); // "" = semua tim
  const [area, setArea] = useState(""); // "" = semua area
  const [bukaArea, setBukaArea] = useState(null); // dropdown area: satu terbuka, yang lain menutup
  const [perlu, setPerlu] = useState(null); // tahap yang menunggu foto wajib: { it, s, persen }
  // Centang langsung tampil sebelum server membalas ({ "itemId:tahap": persen }); dibuang saat data baru tiba.
  const [lokal, setLokal] = useState({});
  useEffect(() => setLokal({}), [itemsAsli]);
  const items = useMemo(() => itemsAsli.filter(itemProgres).map((it) => {
    let o = null;
    for (const [key, p] of Object.entries(lokal)) {
      const [id, k] = key.split(":");
      if (id !== it.id) continue;
      o ||= { progres: { ...it.progres }, porsi: { ...it.porsi } };
      if (p > 0) { o.progres[k] = tanggal; o.porsi[k] = p; } else { delete o.progres[k]; delete o.porsi[k]; }
    }
    return o ? { ...it, ...o } : it;
  }), [itemsAsli, lokal, tanggal]);
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

  // persen 0 = batal, 100 = selesai, di antaranya = baru sebagian.
  async function catat(it, s, persen) {
    // Foto wajib: tahap baru dicatat setelah minimal 1 foto untuk tahap itu ada.
    if (persen > 0 && s.w > 0 && !fotoProgres.some((f) => f.item_id === it.id && f.tahap === s.k)) return setPerlu({ it, s, persen });
    const key = `${it.id}:${s.k}`;
    setBusy(key);
    setLokal((l) => ({ ...l, [key]: persen }));
    const ok = await aksi.jalankan(
      () => A.setProgres(it.id, s.k, persen),
      !persen ? `${s.label} dibatalkan · ${it.nama}`
        : persen >= 100 ? `${s.label} ✓ ${tgl(tanggal)} · ${it.nama}`
        : `${s.label} ${pct(persen)} · ${it.nama}`
    );
    if (!ok) setLokal((l) => { const n = { ...l }; delete n[key]; return n; });
    setBusy(null);
  }
  // Ketuk tombol/bar: tahap tercatat -> batal, belum -> selesai 100%.
  const toggle = (it, s) => catat(it, s, it.progres[s.k] ? 0 : 100);

  // Satu kartu item: nama, bar fase berjalan, dan (dibuka) semua tahap.
  const fotoItem = (it) => fotoProgres.filter((f) => f.item_id === it.id);
  const kartu = (it) => {
    const akhir = tahapTerakhir(it), next = tahapBerikut(it), open = !lihat && buka === it.id; // tukang (lihat): tanpa dropdown tahap
    const fase = faseKini(it);
    // Fase yang sudah selesai (terisi penuh) + fase berjalan; kalau semua selesai,
    // semua tahap (penuh). Fase yang masih terkunci tidak tampil/tidak bisa dicatat.
    // Bar fokus ke fase berjalan: fase yang sudah selesai diringkas jadi satu garis hijau bercentang
    // di kiri, dan yang dipotong-potong hanya tahap fase berjalan (urut: yang sudah selesai dulu).
    const iFase = fase ? FASE.findIndex((f) => f.k === fase.k) : FASE.length;
    const bar = fase ? tahapBar(it).filter((s) => s.w > 0 && s.fase === fase.k) : [];
    const adaFaseLalu = tahapItem(it).some((s) => s.w > 0 && FASE.findIndex((f) => f.k === s.fase) < iFase);
    return (
      <div key={it.id} className={`item acc${open ? " open" : ""}`}>
        <div role={lihat ? undefined : "button"} tabIndex={lihat ? undefined : 0} className="acc-h" aria-expanded={lihat ? undefined : open}
          style={lihat ? { cursor: "default" } : undefined} onClick={lihat ? undefined : () => setBuka(open ? null : it.id)}
          onKeyDown={lihat ? undefined : (e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setBuka(open ? null : it.id); } }}>
          <span className="t">
            <span className="nm">{it.nama}</span>
            <span className="small">{[it.kode, JENIS_LABEL[it.jenis], !tim && it.tim].filter(Boolean).join(" · ")}</span>
          </span>
          <FotoProgres item={it} foto={fotoItem(it)} aksi={aksi} lihat={lihat} />
          {it.foto?.length > 0 && <FotoItem nama={it.nama} foto={it.foto} />}
          {!next && <i className="ceklis" role="img" aria-label="Selesai"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></i>}
          <b className="num">{persenItem(it)}%</b>
          {!lihat && <i className="chev" aria-hidden="true" />}
        </div>
        {/* Tiap bagian bar = satu tahap yang sudah terbuka (lebar = bobotnya), terisi
            sebanyak persen tahap itu; boleh dicentang tidak berurutan. */}
        <div className="track tap">
          {adaFaseLalu && <span className={`trk-done${fase ? "" : " penuh"}`} role="img" aria-label={fase ? "Fase sebelumnya selesai" : "Semua tahap selesai"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>}
          {bar.map((s) => {
            const p = persenTahap(it, s);
            return (
              <button key={s.k} type="button" className={p ? "on" : ""} disabled={kunci}
                style={{ flex: s.w, "--c": WARNA[s.fase], ...isiBar(p, s.fase), ...(busy === `${it.id}:${s.k}` ? { opacity: 0.5 } : null) }}
                title={p ? `${s.label} ${p >= 100 ? "✓" : pct(p)} ${tgl(it.progres[s.k])}` : s.label}
                aria-label={p ? `Batalkan ${s.label}` : `Catat ${s.label}`} aria-pressed={!!p}
                onClick={() => toggle(it, s)} />
            );
          })}
        </div>
        {open ? (
          <TahapItem it={it} aksi={aksi} admin={admin} kunci={kunci} busy={busy} toggle={toggle} catat={catat} foto={fotoItem(it)} lihat={lihat} />
        ) : (
          <div className="acc-q">
            <span className="small">
              {fase && <b style={{ fontWeight: 600 }}>{fase.label} {pct(fase.persen)} · </b>}
              {akhir ? `${akhir.label} ${tahapSelesai(it, akhir) ? "✓" : pct(persenTahap(it, akhir))} ${tgl(akhir.tgl)}` : "Belum mulai"}
              {fotoItem(it).length > 0 && ` · ${fotoItem(it).length} foto progres`}
            </span>
            {!next && <span className="badge b-ok">Selesai 100%</span>}
          </div>
        )}
      </div>
    );
  };
  return (
    <>
      {perlu && (
        <FotoWajib item={perlu.it} s={perlu.s} persen={perlu.persen} aksi={aksi} tutup={() => setPerlu(null)}
          sisa={Math.max(0, 20 - fotoItem(perlu.it).length)} />
      )}
      {/* Pengingat deadline (hanya label, tidak bisa diubah). */}
      <div className="card tglrow" style={{ padding: "12px 14px" }}>
        <span>Deadline</span>
        {proyek.deadline ? (
          <span className="row" style={{ alignItems: "center", textTransform: "none", letterSpacing: 0 }}>
            <b className="num" style={{ fontSize: ".9rem", color: "var(--fg)" }}>{tglTh(proyek.deadline)}</b>
            <span className={`badge ${kelasSisa}`}>{sisa}</span>
          </span>
        ) : (
          <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 700, color: "var(--bad)" }}>Belum ditetapkan</span>
        )}
      </div>
      {lihat && (
        <p className="small" style={{ margin: 0 }}>Progres dicatat oleh supervisor.</p>
      )}
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
        const pa = persenProyek(its);
        // Satu dropdown per area (Living Room, Powder Room, ...); terbuka otomatis kalau area dipilih lewat saringan.
        return (
          <details key={a} className="lipat" open={!!area || bukaArea === a}>
            <summary onClick={(e) => { e.preventDefault(); setBuka(null); setBukaArea(bukaArea === a ? null : a); }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="row">
                  <h2>{a}</h2>
                  <span className="num small" style={{ margin: 0, whiteSpace: "nowrap" }}>{pct(pa)} · {its.length} item</span>
                </span>
                <span className="bar" style={{ display: "block", marginTop: 8 }}><i style={{ width: `${pa}%` }} /></span>
              </span>
            </summary>
            <div className="lipat-b">{its.map(kartu)}</div>
          </details>
        );
      })}
    </>
  );
}

// Warna progres tahap per tingkat, sengaja beda jelas supaya mudah dibaca
// sekilas: oranye 1–30%, kuning 31–60%, hijau muda 61–99%, hijau 100%
// (variabel --p1..--p4 di portal.css). Dipakai bar dan tombol tahap.
const warnaPersen = (p) => (p >= 100 ? "var(--p4)" : p > 60 ? "var(--p3)" : p > 30 ? "var(--p2)" : "var(--p1)");
// Potongan bar satu tahap: terisi selebar persennya. Tahap 100% memakai warna
// fasenya (WARNA) supaya Produksi, Pengiriman, dst. terbedakan di bar.
const isiBar = (p, fase) =>
  p > 0 ? { background: p < 100 ? `linear-gradient(to right, ${warnaPersen(p)} ${p}%, var(--sunk) ${p}%)` : WARNA[fase] } : null;
// Tombol tahap ikut terisi sebanyak persennya (warna dimudakan supaya teks
// tetap terbaca); 100% = tombol penuh hijau.
const isiTombol = (p) =>
  !p ? null
    : p >= 100 ? { "--c": warnaPersen(p), background: warnaPersen(p), borderColor: warnaPersen(p) }
    : { "--c": warnaPersen(p), background: `linear-gradient(to right, color-mix(in srgb, ${warnaPersen(p)} 60%, var(--surface)) ${p}%, var(--surface) ${p}%)` };

// Semua tahap satu item per fase. Tiap tahap: tombol centang (ketuk = selesai
// 100% / batal) dan slider + kotak ketik untuk persen pengerjaannya (mis. Potong
// baru 10%). Persen tersimpan saat slider dilepas atau kotak ketik ditinggalkan;
// 0 = batal. Bobot tahap diatur admin di halaman Bobot tahap.
function TahapItem({ it, aksi, admin, kunci, busy, toggle, catat, foto, lihat }) {
  const tahap = tahapItem(it);
  const awal = Object.fromEntries(tahap.map((s) => [s.k, persenTahap(it, s)]));
  const kunciAwal = JSON.stringify(awal);
  const [v, setV] = useState(awal);
  useEffect(() => setV(JSON.parse(kunciAwal)), [kunciAwal]);
  // Slider meloncat per 10% (dibulatkan ke kelipatan 10 terdekat); bukan
  // step="10" supaya nilai yang bukan kelipatan 10 (hasil ketik) tetap tampil di
  // posisi yang benar. Panah keyboard ±10.
  const geser = (k, x) => setV({ ...v, [k]: Math.min(100, Math.max(0, Math.round(x / 10) * 10)) });
  const panah = (k) => (e) => {
    const arah = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!arah) return;
    e.preventDefault();
    geser(k, v[k] + arah * 10);
  };
  // Kotak ketik: angka bebas 0–100 (boleh pecahan). Kosong = 0; di luar 0–100 diabaikan.
  const ketik = (k, x) => {
    const n = x === "" ? 0 : Number(x);
    if (n >= 0 && n <= 100) setV({ ...v, [k]: n });
  };
  // Simpan kalau berbeda dari yang tercatat.
  const kirim = (s) => v[s.k] !== awal[s.k] && catat(it, s, v[s.k]);
  // Fase sebelum fase berjalan sudah selesai 100%: tombolnya disembunyikan supaya
  // yang tampil hanya fase berikutnya. Bisa dibuka lagi untuk membetulkan salah centang.
  const kini = faseKini(it);
  const iKini = kini ? FASE.findIndex((f) => f.k === kini.k) : FASE.length;
  const faseLewat = FASE.slice(0, iKini).filter((f) => tahap.some((s) => s.fase === f.k));
  const [lihatLewat, setLihatLewat] = useState(false);

  return (
    <div className="acc-b">
      {faseLewat.length > 0 && (
        <div className="row small" style={{ alignItems: "center" }}>
          <span><b style={{ fontWeight: 600 }}>{faseLewat.map((f) => f.label).join(", ")}</b> selesai ✓</span>
          <button type="button" className="act" onClick={() => setLihatLewat(!lihatLewat)}>
            {lihatLewat ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>
      )}
      {FASE.map((f, i) => {
        const st = tahap.filter((s) => s.fase === f.k);
        if (i < iKini && !lihatLewat) return null;
        // Fase yang fase sebelumnya belum selesai 100% disembunyikan, kecuali
        // sudah ada tahap tercatat (data lama), supaya masih bisa dibatalkan.
        const tutup = faseTerkunci(it, f.k);
        if (!st.length || (tutup && !st.some((s) => it.progres[s.k]))) return null;
        return (
          <div key={f.k}>
            <div className="fl">{f.label}{tutup && " · terkunci"}</div>
            <div className="pills">
              {st.map((s) => {
                const p = awal[s.k];
                const mati = kunci || (tutup && !p);
                return (
                  <div key={s.k} className="tahap-sel">
                    <button type="button" className={`pill${p && p < 100 ? " sebagian" : ""}`} aria-pressed={!!p}
                      disabled={mati} style={{ ...isiTombol(p), ...(busy === `${it.id}:${s.k}` ? { opacity: 0.5 } : null) }}
                      onClick={() => toggle(it, s)}>
                      {/* Kotak centang: kosong = ketuk untuk selesai, terisi = sudah dikerjakan, gembok = fase terkunci. */}
                      <i className={`kotak${tutup && !p ? " gembok" : ""}`} aria-hidden="true" />
                      <span className="nm">{s.label}</span>
                      {p > 0 && <span className="w">{p < 100 ? pct(p) : tgl(it.progres[s.k])}</span>}
                    </button>
                    <div className="geser mini">
                      <input type="range" min="0" max="100" step="1" value={v[s.k]} disabled={mati}
                        aria-label={`Progres ${s.label}`} style={{ accentColor: v[s.k] ? warnaPersen(v[s.k]) : WARNA[s.fase] }}
                        onChange={(e) => geser(s.k, Number(e.target.value))} onKeyDown={panah(s.k)}
                        onPointerUp={() => kirim(s)} onKeyUp={() => kirim(s)} onBlur={() => kirim(s)} />
                      <label className="ketik num">
                        <input type="number" inputMode="decimal" min="0" max="100" step="any" value={v[s.k]} disabled={mati}
                          aria-label={`Progres ${s.label} (ketik)`} onFocus={(e) => e.target.select()}
                          onChange={(e) => ketik(s.k, e.target.value)} onBlur={() => kirim(s)}
                          onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />%
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {admin && it.bobot_khusus && (
        <div className="row small" style={{ alignItems: "center" }}>
          <span>Item ini memakai bobot tahap khusus.</span>
          <button type="button" className="act" disabled={aksi.sibuk}
            onClick={() => confirm(`Kembalikan bobot ${it.nama} ke bobot bawaan jenisnya?`) &&
              aksi.jalankan(() => A.simpanBobotItem(it.id, null), `Bobot ${it.nama} kembali ke bawaan.`)}>
            Kembali ke bawaan
          </button>
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
// `akhiran` = satuan tetap di ujung kanan kotak (mis. "%"), tidak ikut tersimpan.
function Isian({ label, nilai, onSimpan, akhiran, ...rest }) {
  const awal = String(nilai ?? "");
  const input = (
    <input className="inp" defaultValue={awal} {...rest}
      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
      onBlur={async (e) => {
        const el = e.target, v = el.value.trim();
        if (v !== awal && !(await onSimpan(v))) el.value = awal;
      }} />
  );
  return (
    <label className="lbl">{label}
      {akhiran ? <span className="akhiran">{input}<i aria-hidden="true">{akhiran}</i></span> : input}
    </label>
  );
}

// Satu dropdown per area di tab Jasa tukang: nama area, jumlah item, dan total jasanya.
function AreaJasa({ area, items, children, terbuka, onToggle }) {
  const its = items.filter((i) => i.area === area);
  const total = its.reduce((a, i) => a + (Number(i.harga) || 0), 0);
  return (
    <details className="lipat" {...(onToggle ? { open: terbuka } : null)}>
      <summary {...(onToggle ? { onClick: (e) => { e.preventDefault(); onToggle(); } } : null)}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="row">
            <h2>{area}</h2>
            <span className="num small" style={{ margin: 0, whiteSpace: "nowrap" }}>{total ? `${rp(total)} · ` : ""}{its.length} item</span>
          </span>
        </span>
      </summary>
      <div className="lipat-b">{children(its)}</div>
    </details>
  );
}

function TabItem({ proyek, items, aksi }) {
  const [buka, setBuka] = useState(null);
  const [bukaArea, setBukaArea] = useState(null); // satu area terbuka sekaligus
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
        <AreaJasa key={a} area={a} items={items} terbuka={bukaArea === a} onToggle={() => setBukaArea(bukaArea === a ? null : a)}>
          {(its) => its.map((it) => {
            const open = buka === it.id;
            return (
              <div key={it.id} className={`item acc${open ? " open" : ""}`}>
                <div role="button" tabIndex={0} className="acc-h" aria-expanded={open} onClick={() => setBuka(open ? null : it.id)}
                  onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setBuka(open ? null : it.id); } }}>
                  <span className="t">
                    <span className="nm">{it.nama}</span>
                    <span className="small">
                      {[it.kode, teksQty(it), it.dimensi, it.harga_satuan && `@ ${rp(it.harga_satuan)}`, it.tim].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {it.foto?.length > 0 && <FotoItem nama={it.nama} foto={it.foto} />}
                  <span className="num small">{it.harga ? rp(it.harga) : "—"}</span>
                  <i className="chev" aria-hidden="true" />
                </div>
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
        </AreaJasa>
      ))}

      <UploadItem proyek={proyek} items={items} areas={areas} urutan={urutan} aksi={aksi} />
    </>
  );
}

// Upah jasa tukang per minggu dan per tim (laporan di Mingguan.jsx), dilipat di tab Jasa tukang.
function UpahMingguan({ proyek, items, riwayat, lihatTim }) {
  return (
    <details className="lipat">
      <summary><b>Upah jasa tukang per minggu</b></summary>
      <div className="lipat-b" style={{ gap: 12 }}>
        <Mingguan proyek={proyek} items={items} riwayat={riwayat} tampil="upah" lihatTim={lihatTim} />
      </div>
    </details>
  );
}

// Total jasa tukang semua item, dipecah per tim.
function RingkasJasa({ items }) {
  const total = items.reduce((a, i) => a + (Number(i.harga) || 0), 0);
  const perTim = {};
  for (const i of items) if (Number(i.harga) > 0) perTim[i.tim || "Belum ada tim"] = (perTim[i.tim || "Belum ada tim"] || 0) + Number(i.harga);
  const tim = Object.keys(perTim);
  // Pendapatan dari progres = harga tiap item × persen progresnya sekarang.
  const dapat = items.reduce((a, i) => a + ((Number(i.harga) || 0) * persenItem(i)) / 100, 0);
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <h3>Total jasa tukang{tim.length === 1 && <span className="small" style={{ fontWeight: 400 }}> ({tim[0]})</span>}</h3>
        <b className="num">{total ? rp(total) : "—"}</b>
      </div>
      {total > 0 && (
        <div className="row small"><span>Total pendapatan dari progres</span><span className="num">{rp(Math.round(dapat))}</span></div>
      )}
      {tim.length > 1 && Object.entries(perTim).map(([t, n]) => (
        <div key={t} className="row small"><span>{t}</span><span className="num">{rp(n)}</span></div>
      ))}
    </div>
  );
}

// Jasa tukang untuk tukang: hanya total per item (harga satuan tidak dikirim
// dari server), tanpa isian apa pun.
function JasaTukangLihat({ items, proyek, riwayat }) {
  const areas = [...new Set(items.map((i) => i.area))];
  const [buka, setBuka] = useState("mingguan"); // laporan mingguan langsung terbuka
  const [bukaArea, setBukaArea] = useState(null); // satu area SPKB terbuka sekaligus
  return (
    <>
      <DuaTombol buka={buka} setBuka={setBuka} pilihan={[["mingguan", "Jasa mingguan"], ["spkb", "SPKB"]]} />
      {buka === "mingguan" && (
        <div className="stack" style={{ gap: 12 }}>
          <Mingguan proyek={proyek} items={items} riwayat={riwayat} tampil="upah" lihatTim />
        </div>
      )}
      {/* SPKB: daftar item jasa per area; tiap area dibuka sendiri-sendiri. */}
      {buka === "spkb" && areas.map((a) => (
        <AreaJasa key={a} area={a} items={items} terbuka={bukaArea === a} onToggle={() => setBukaArea(bukaArea === a ? null : a)}>
          {(its) => its.map((it) => (
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
        </AreaJasa>
      ))}
    </>
  );
}

// Dua tombol sebaris (hemat tempat); yang dipilih membuka isinya selebar penuh di bawahnya,
// ketuk lagi untuk menutup. `pilihan` = [[kunci, label], ...].
function DuaTombol({ pilihan, buka, setBuka }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {pilihan.map(([k, judul]) => (
        <button key={k} type="button" className="lipat" aria-expanded={buka === k} onClick={() => setBuka(buka === k ? null : k)}
          style={{ minHeight: 56, padding: "10px 14px", font: "inherit", fontWeight: 700, color: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", ...(buka === k ? { borderColor: "var(--muted)" } : null) }}>
          {judul}
          <i className="chev" aria-hidden="true" style={buka === k ? { transform: "rotate(-135deg)", marginTop: 4 } : undefined} />
        </button>
      ))}
    </div>
  );
}

// Total jasa tukang di kartu atas (tampilan tukang), dengan tombol mata untuk menyembunyikan
// nominal seperti saldo di aplikasi bank. Awalnya tersembunyi.
function KartuJasaSaya({ items }) {
  const total = items.reduce((a, i) => a + (Number(i.harga) || 0), 0);
  const dapat = items.reduce((a, i) => a + ((Number(i.harga) || 0) * persenItem(i)) / 100, 0);
  const [sembunyi, setSembunyi] = useState(true); // setiap dibuka, nominal tersembunyi dulu
  const ubah = () => setSembunyi(!sembunyi);
  const tampil = (n) => (sembunyi ? "Rp ••••••" : n);
  return (
    <div className="stat" style={{ position: "relative", paddingRight: 52 }}>
      <div className="eb">Total jasa</div>
      <div>
        <button type="button" className="mata" aria-label={sembunyi ? "Tampilkan nominal" : "Sembunyikan nominal"} aria-pressed={sembunyi} onClick={ubah}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
            {sembunyi && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
      <div className="v num" style={{ fontSize: "clamp(.95rem,4.3vw,1.1rem)" }}>{total ? tampil(rp(total)) : "—"}</div>
      <div className="s">{total > 0 ? `Pendapatan saat ini ${tampil(rp(Math.round(dapat)))}` : "belum ada nilai jasa"}</div>
    </div>
  );
}

function TambahItem({ proyek, areas, urutan, aksi }) {
  const kosong = { area: areas[areas.length - 1] || "", nama: "", kode: "", jenis: "HPL", qty: "1", satuan: "unit", dimensi: "", harga_satuan: null, harga: null, tim: "" };
  const [f, setF] = useState(kosong);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // Area dipilih dari dropdown (semua area proyek + Lain-lain); "+ Area baru…" membuka kolom ketik.
  const pilihanArea = [...new Set([...areas, "Lain-lain"])];
  const [areaBaru, setAreaBaru] = useState(!areas.length);

  return (
    <>
      <form className="stack" style={{ gap: 12 }} onSubmit={async (e) => {
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
          <label className="lbl">Area
            <select className="inp" required value={areaBaru ? "__baru" : f.area}
              onChange={(e) => {
                const baru = e.target.value === "__baru";
                setAreaBaru(baru);
                setF({ ...f, area: baru ? "" : e.target.value });
              }}>
              {pilihanArea.map((a) => <option key={a} value={a}>{a}</option>)}
              <option value="__baru">+ Area baru…</option>
            </select>
          </label>
          <label className="lbl">Kode<input className="inp" value={f.kode} onChange={set("kode")} placeholder="FF.01" /></label>
        </div>
        {areaBaru && (
          <label className="lbl">Nama area baru<input className="inp" required autoFocus value={f.area} onChange={set("area")} placeholder="Kamar Anak" /></label>
        )}
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
    </>
  );
}

function ImporBoq({ proyek, items, urutan, aksi }) {
  const [teks, setTeks] = useState("");
  const [file, setFile] = useState(null); // { sheet, rows } dari UnggahBoq
  const [unggahKe, setUnggahKe] = useState(0); // ganti key = kosongkan pilihan file
  // perbarui = isi harga/total/tim item yang sama (progres tidak tersentuh), tambah = item baru saja, ganti = hapus semua lalu isi.
  const [mode, setMode] = useState(items.length ? "perbarui" : "tambah");
  const ganti = mode === "ganti", perbarui = mode === "perbarui";
  const [centang, setCentang] = useState({}); // { [n]: true/false } centang yang diubah admin
  const preview = useMemo(() => (file ? bacaItemSheet(file.rows, urutan, file.gambar) : teks ? bacaBoq(teks, urutan) : []), [file, teks, urutan]);
  const sudahAda = useMemo(() => new Set(items.map(kunciItem)), [items]);
  // Baris Excel -> item proyek yang sama (area, nama, kode); tiap item dipakai sekali.
  const cocokan = useMemo(() => {
    const sisa = new Map();
    for (const i of items) { const k = kunciItem(i); sisa.set(k, [...(sisa.get(k) || []), i]); }
    return preview.map((p) => sisa.get(kunciItem(p))?.shift() || null);
  }, [items, preview]);

  // Saat menambah, baris yang sudah ada di proyek tidak dicentang (impor dua kali tidak menggandakan).
  // Mode perbarui: baris yang cocok dan membawa harga/tim dicentang, baris baru tidak.
  const kembar = (p) => !ganti && !perbarui && sudahAda.has(kunciItem(p));
  const awal = (p, n) => (perbarui ? !!cocokan[n] && (p.harga != null || p.harga_satuan != null || !!p.tim) : !kembar(p));
  const dipakai = (p, n) => centang[n] ?? awal(p, n);
  const terpilihN = preview.map((p, n) => [p, n]).filter(([p, n]) => dipakai(p, n));
  const terpilih = terpilihN.map(([p]) => p);
  const diperbarui = perbarui ? terpilihN.filter(([, n]) => cocokan[n]) : [];
  const barus = perbarui ? terpilihN.filter(([, n]) => !cocokan[n]).map(([p]) => p) : terpilih;
  const nKembar = preview.filter(kembar).length;
  const nProgres = items.reduce((a, i) => a + Object.keys(i.progres).length, 0);
  const areaPv = [...new Set(preview.map((p) => p.area))];
  const sumberBaru = () => setCentang({});

  async function simpan() {
    if (ganti && !confirm(`Ganti seluruh BOQ? ${items.length} item lama${nProgres ? ` dan ${nProgres} centang progresnya` : ""} akan dihapus.`)) return;
    const ok = await aksi.jalankan(
      async () => {
        let gagalFoto = 0, pesanFoto = "";
        if (perbarui && diperbarui.length) {
          // Hanya harga, total, tim (kalau ada di Excel) dan foto untuk item yang belum punya foto.
          const baris = diperbarui.map(([p, n]) => {
            const lama = cocokan[n];
            const r = { id: lama.id };
            if (p.harga != null) r.harga = p.harga;
            if (p.harga_satuan != null) r.harga_satuan = p.harga_satuan;
            if (p.tim) r.tim = p.tim;
            if (!lama.foto?.length && p._gambar?.length) r._gambar = p._gambar;
            return r;
          });
          const f = await unggahFotoItem(proyek.id, baris);
          gagalFoto += f.gagal; pesanFoto ||= f.pesan;
          const r = await A.simpanJasaTukang(proyek.id, f.items);
          if (r?.error) return r;
        }
        if (barus.length || ganti) {
          const f = await unggahFotoItem(proyek.id, barus);
          gagalFoto += f.gagal; pesanFoto ||= f.pesan;
          const r = await (ganti ? A.gantiItem(proyek.id, f.items) : A.tambahItem(proyek.id, f.items));
          if (r?.error) return r;
        }
        if (gagalFoto) alert(`${gagalFoto} foto gagal diunggah (${pesanFoto}); itemnya tetap tersimpan.`);
        return {};
      },
      ganti ? `BOQ diganti dengan ${terpilih.length} item.`
        : perbarui ? `${diperbarui.length} item diperbarui${barus.length ? `, ${barus.length} item ditambahkan` : ""}.`
        : `${terpilih.length} item ditambahkan.`
    );
    if (!ok) return;
    setTeks("");
    setFile(null);
    setMode("perbarui");
    sumberBaru();
    setUnggahKe((n) => n + 1);
  }

  return (
    <>
      <div className="stack" style={{ gap: 12 }}>
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
                <button type="button" aria-pressed={perbarui} onClick={() => { setMode("perbarui"); setCentang({}); }}>Perbarui</button>
                <button type="button" aria-pressed={mode === "tambah"} onClick={() => { setMode("tambah"); setCentang({}); }}>Tambahkan</button>
                <button type="button" aria-pressed={ganti} onClick={() => { setMode("ganti"); setCentang({}); }}>Ganti semua</button>
              </div>
            </div>
          )}
          {perbarui && (
            <p className="note b-ok">
              Item yang sama (area, nama, dan kode) hanya diubah harga satuan, total jasa, dan timnya. Progres, centang, dan item lain tidak disentuh.
              {!preview.some((p, n) => cocokan[n] && (p.harga != null || p.harga_satuan != null || p.tim)) && " Tidak ada harga yang terbaca untuk item yang cocok; pastikan memilih sheet Hitungan Jasa Pekerjaan."}
            </p>
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
                      <span className="small">{[p.kode, teksQty(p), p.dimensi, p.harga != null && rp(p.harga), p._gambar?.length > 0 && `${p._gambar.length} foto`, kembar(p) && "sudah ada", perbarui && (cocokan[n] ? "diperbarui" : "belum ada di proyek")].filter(Boolean).join(" · ")}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
      <button type="button" className="btn" disabled={aksi.sibuk || !terpilih.length} onClick={simpan}>
        {ganti ? `Ganti dengan ${terpilih.length} item` : perbarui ? `Perbarui ${diperbarui.length} item${barus.length ? ` + tambah ${barus.length}` : ""}` : `Tambahkan ${terpilih.length || ""} item`}
      </button>
      </div>
    </>
  );
}

// Dua tombol sebaris (hemat tempat): upload file Excel / tempel BoQ, atau tambah satu item manual.
// Isi tombol yang dipilih terbuka selebar penuh di bawahnya.
function UploadItem({ proyek, items, areas, urutan, aksi }) {
  const [buka, setBuka] = useState(null);
  const tombol = (k, judul) => (
    <button type="button" className="lipat" aria-expanded={buka === k} onClick={() => setBuka(buka === k ? null : k)}
      style={{ minHeight: 56, padding: "10px 14px", font: "inherit", fontWeight: 700, color: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", ...(buka === k ? { borderColor: "var(--muted)" } : null) }}>
      {judul}
      <i className="chev" aria-hidden="true" style={buka === k ? { transform: "rotate(-135deg)", marginTop: 4 } : undefined} />
    </button>
  );
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {tombol("excel", "Upload file Excel")}
        {tombol("manual", "Tambah manual")}
      </div>
      {buka && (
        <div className="lipat">
          <div className="lipat-b" style={{ gap: 12, paddingTop: 14 }}>
            {buka === "excel"
              ? <ImporBoq proyek={proyek} items={items} urutan={urutan} aksi={aksi} />
              : <TambahItem proyek={proyek} areas={areas} urutan={urutan} aksi={aksi} />}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Termin ---------- */
// Termin jasa produksi, dari nilai proyek (terpisah dari nilai jasa tukang). Persennya berjumlah 100%.
function TabTermin({ proyek, items, termin, addon, nilai, aksi }) {
  const totalAddon = addon.reduce((a, x) => a + x.nilai, 0);
  const masukAddon = addon.reduce((a, x) => a + (x.lunas_tgl ? x.nilai : 0), 0);
  const masuk = totalDibayar(termin, nilai) + masukAddon;
  const total = totalNilai(nilai) + totalAddon;
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
      <AddonBiaya proyek={proyek} addon={addon} aksi={aksi} />
    </>
  );
}

// Penambahan biaya di luar nilai proyek awal; ditagih terpisah dari termin.
function AddonBiaya({ proyek, addon, aksi }) {
  const [nama, setNama] = useState("");
  const [nilai, setNilai] = useState(null);
  const [reset, setReset] = useState(0);
  const ubah = (id, patch, ok) => aksi.jalankan(() => A.ubahAddon(id, patch), ok);
  const total = addon.reduce((a, x) => a + x.nilai, 0);

  return (
    <section className="stack">
      <div className="row" style={{ marginTop: 6 }}>
        <h2>Addons</h2>
        {total > 0 && <span className="small num">{rp(total)}</span>}
      </div>
      {addon.map((x) => (
        <div key={x.id} className="item">
          <div className="g2" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <Isian label="Nama" nilai={x.nama} onSimpan={(v) => v.trim() && ubah(x.id, { nama: v })} />
            <label className="lbl">Nilai
              <InputRupiah nilai={x.nilai} onSimpan={(v) => v != null && ubah(x.id, { nilai: v }, `Nilai ${x.nama} disimpan: ${rp(v)}.`)} />
            </label>
          </div>
          {x.lunas_tgl && <span className="badge b-ok" style={{ alignSelf: "flex-start" }}>Lunas {tgl(x.lunas_tgl)}</span>}
          <div className="acts">
            {!x.lunas_tgl ? (
              <button type="button" className="act" disabled={aksi.sibuk}
                onClick={() => ubah(x.id, { lunas_tgl: hariIni() }, `${x.nama} lunas ${tgl(hariIni())}.`)}>Lunas hari ini</button>
            ) : (
              <button type="button" className="act" disabled={aksi.sibuk}
                onClick={() => confirm(`Batalkan status lunas ${x.nama}?`) && ubah(x.id, { lunas_tgl: null }, `Status lunas ${x.nama} dibatalkan.`)}>Batalkan lunas</button>
            )}
            <button type="button" className="act bahaya" disabled={aksi.sibuk}
              onClick={() => confirm(`Hapus ${x.nama}?`) && aksi.jalankan(() => A.hapusAddon(x.id), "Addon dihapus.")}>Hapus</button>
          </div>
        </div>
      ))}
      <details className="lipat">
        <summary><b>+ Tambah addon</b></summary>
        <form className="lipat-b" style={{ gap: 12 }} onSubmit={async (e) => {
          e.preventDefault();
          if (!nama.trim() || nilai == null) return;
          const ok = await aksi.jalankan(() => A.tambahAddon(proyek.id, { nama, nilai }), `${nama.trim()} ditambahkan.`);
          if (ok !== false) { setNama(""); setNilai(null); setReset((n) => n + 1); }
        }}>
          <label className="lbl">Nama<input className="inp" required value={nama} onChange={(e) => setNama(e.target.value)} placeholder="mis. Tambah lemari" /></label>
          <label className="lbl">Nilai
            <InputRupiah key={reset} nilai={nilai} onSimpan={setNilai} />
          </label>
          <button className="btn" disabled={aksi.sibuk || !nama.trim() || nilai == null}>Tambah</button>
        </form>
      </details>
    </section>
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
  // Foto bukti pembayaran: dikecilkan di browser, diunggah lewat route (bukan server action, batas 1 MB), lalu path-nya disimpan di termin.
  const unggahBukti = (t, nama) => async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await aksi.jalankan(async () => {
      const fd = new FormData();
      fd.append("proyek_id", proyek.id);
      fd.append("foto", await kompresGambar(file, { sisiMaks: 1280, kualitas: 0.75 }));
      const r = await fetch("/api/portal/item-foto", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.path) return { error: j.error || "foto gagal diunggah." };
      return A.ubahTermin(t.id, { bukti: j.path });
    }, `Bukti pembayaran ${nama} diunggah.`);
  };
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
                  <Isian label="Persen" akhiran="%" inputMode="decimal" style={{ textAlign: "right" }} nilai={Number(t.persen).toLocaleString("id-ID")}
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
                {/* Foto bukti pembayaran wajib sebelum termin bisa ditandai lunas. */}
                <div className="row" style={{ alignItems: "center", gap: 10 }}>
                  {t.bukti_url && <FotoItem nama={`Bukti ${nama}`} foto={[t.bukti_url]} />}
                  {!t.lunas_tgl && (
                    <label className="act" style={{ cursor: "pointer" }}>
                      {t.bukti ? "Ganti foto bukti" : "Unggah foto bukti"}
                      <input type="file" accept="image/*" hidden disabled={aksi.sibuk} onChange={unggahBukti(t, nama)} />
                    </label>
                  )}
                  {!t.bukti && <span className="small">Wajib sebelum ditandai lunas.</span>}
                </div>
                <div className="acts">
                  {!t.lunas_tgl ? (
                    <button type="button" className="act" disabled={aksi.sibuk || !t.bukti} onClick={() => lunas(t, nama, hariIni())}>Lunas hari ini</button>
                  ) : (
                    <button type="button" className="act" disabled={aksi.sibuk}
                      onClick={() => confirm(`Batalkan status lunas ${nama}? Foto bukti pembayarannya ikut dihapus.`) && ubah(t.id, { lunas_tgl: null, dibayar: null, bukti: null }, `Status lunas ${nama} dibatalkan.`)}>
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

/* ---------- Defect dari klien ---------- */
// Keluhan yang dikirim klien lewat link (tab Defect di halaman klien). Yang
// belum selesai di atas. Status & tanggapan tampil di halaman klien.
const URUT_DEFECT = { BARU: 0, DIPROSES: 1, SELESAI: 2 };
const MAKS_FOTO_TANGGAPAN = 5; // sama dengan MAKS_FOTO_DEFECT di lib/portal/defect.js
const tglJkt = (ts) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

function TabDefect({ items, defect, aksi, admin, mandor }) {
  const namaItem = Object.fromEntries(items.map((i) => [i.id, i.nama]));
  const urut = [...defect].sort((a, b) => URUT_DEFECT[a.status] - URUT_DEFECT[b.status] || b.created_at.localeCompare(a.created_at));
  // Tersambung ke proyek Mandor dengan nama sama: laporan klien masuk Defect List Mandor.
  const infoMandor = mandor && (
    <div className="card stack" style={{ gap: 10 }}>
      <p className="small" style={{ margin: 0 }}>
        Laporan klien proyek ini otomatis masuk ke <b>Defect List</b> Aplikasi Mandor (proyek {mandor.nama}) dan dikerjakan
        lewat alur biasa: mandor kerjakan, kirim bukti, supervisor setujui. Status dan foto bukti yang disetujui tampil di halaman klien.
      </p>
      {mandor.path && <Link href={mandor.path} className="act">Buka Defect List Mandor</Link>}
    </div>
  );
  if (!defect.length)
    return (
      <>
        {infoMandor}
        <div className="card small">
          Belum ada laporan defect dari klien. Klien bisa melapor lewat tab Defect di link klien, lengkap dengan foto.
        </div>
      </>
    );
  return (
    <>
      {infoMandor || (
        <p className="small" style={{ margin: 0 }}>
          Laporan dari klien lewat link. Status dan tanggapan langsung tampil di halaman klien.
        </p>
      )}
      {urut.map((d) => <KartuDefect key={d.id} d={d} namaItem={namaItem} aksi={aksi} admin={admin} />)}
    </>
  );
}

function KartuDefect({ d, namaItem, aksi, admin }) {
  const [tanggapan, setTanggapan] = useState(d.tanggapan || "");
  useEffect(() => setTanggapan(d.tanggapan || ""), [d.tanggapan]);
  const [lab, cls] = STATUS_DEFECT[d.status] || STATUS_DEFECT.BARU;
  const berubah = tanggapan.trim() !== (d.tanggapan || "");
  const fotoT = d.foto_tanggapan || [];
  const [buka, setBuka] = useState(false);

  // Foto dikompres di browser dulu, lalu dikirim lewat route (bukan server
  // action, yang dibatasi 1 MB): app/api/portal/defect/tanggapan.
  async function unggahFoto(e) {
    const files = Array.from(e.target.files || []).slice(0, MAKS_FOTO_TANGGAPAN - fotoT.length);
    e.target.value = "";
    if (!files.length) return;
    await aksi.jalankan(async () => {
      const fd = new FormData();
      fd.set("id", d.id);
      for (const f of await kompresBanyakGambar(files)) fd.append("foto", f);
      const r = await fetch("/api/portal/defect/tanggapan", { method: "POST", body: fd });
      return r.ok ? {} : { error: (await r.json().catch(() => ({}))).error || "foto gagal diunggah." };
    }, files.length > 1 ? `${files.length} foto tanggapan diunggah.` : "Foto tanggapan diunggah.");
  }

  // Tertutup: ringkasan (titik merah = BARU, tanggal · pelapor · item, potongan
  // keterangan, status). Dibuka untuk foto, status, dan tanggapan.
  const baru = d.status === "BARU";
  return (
    <details className={`lipat defect-staf${baru ? " baru" : ""}`} open={buka} onToggle={(e) => setBuka(e.currentTarget.open)}>
      <summary>
        {baru && <i className="titik-baru" aria-label="Defect baru" />}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="nm">{d.keterangan}</span>
          <span className="small">
            {[tglTh(tglJkt(d.created_at)), d.pelapor, d.item_id && namaItem[d.item_id]].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className={`badge ${cls}`}>{lab}</span>
      </summary>
      <div className="lipat-b" style={{ gap: 10 }}>
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{d.keterangan}</p>
      {d.foto.length > 0 && (
        <div className="foto-grid">
          {d.foto.filter((f) => f.url).map((f, n) => (
            <a key={f.path} href={f.url} target="_blank" rel="noreferrer" className="foto"><img src={f.url} alt={`Foto ${n + 1}`} /></a>
          ))}
        </div>
      )}
      {/* Tersambung ke Defect List Mandor: hanya dilihat di sini (status & foto bukti dari Mandor). */}
      {d.mandor ? (
        <>
          {fotoT.length > 0 && (
            <div className="lbl" style={{ gap: 8 }}>Foto bukti (disetujui)
              <div className="foto-grid">
                {fotoT.filter((f) => f.url).map((f, n) => (
                  <a key={f.path} href={f.url} target="_blank" rel="noreferrer" className="foto"><img src={f.url} alt={`Foto bukti ${n + 1}`} /></a>
                ))}
              </div>
            </div>
          )}
          <p className="small" style={{ margin: 0 }}>Dikelola di Defect List Aplikasi Mandor; status di sini mengikuti dari sana.</p>
        </>
      ) : (<>
      <div className="seg" role="group" aria-label="Status defect">
        {Object.entries(STATUS_DEFECT).filter(([k]) => k !== "DITUTUP").map(([k, [l]]) => (
          <button key={k} type="button" aria-pressed={d.status === k} disabled={aksi.sibuk}
            onClick={() => d.status !== k && aksi.jalankan(() => A.ubahDefect(d.id, { status: k }), `Status defect: ${l}.`)}>
            {l}
          </button>
        ))}
      </div>
      <label className="lbl">Tanggapan untuk klien
        <textarea className="inp teks" rows={2} maxLength={1000} value={tanggapan} onChange={(e) => setTanggapan(e.target.value)}
          placeholder="Mis. Tim kami jadwalkan perbaikan hari Senin, 20 Okt." />
      </label>
      {/* Foto tanggapan (mis. sesudah diperbaiki): langsung terunggah saat dipilih, tampil ke klien. */}
      <div className="lbl" style={{ gap: 8 }}>Foto tanggapan ({fotoT.length}/{MAKS_FOTO_TANGGAPAN})
        <div className="foto-grid">
          {fotoT.map((f, n) => (
            <span key={f.path} className="foto">
              {f.url && <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={`Foto tanggapan ${n + 1}`} /></a>}
              <button type="button" className="foto-x" aria-label={`Hapus foto tanggapan ${n + 1}`} disabled={aksi.sibuk}
                onClick={() => confirm("Hapus foto tanggapan ini?") && aksi.jalankan(() => A.hapusFotoTanggapan(d.id, f.path), "Foto tanggapan dihapus.")}>×</button>
            </span>
          ))}
          {fotoT.length < MAKS_FOTO_TANGGAPAN && (
            <label className="foto tambah" aria-disabled={aksi.sibuk}>
              <span aria-hidden="true">+</span>
              <span className="sr">Tambah foto tanggapan</span>
              <input type="file" accept="image/*" multiple hidden disabled={aksi.sibuk} onChange={unggahFoto} />
            </label>
          )}
        </div>
      </div>
      {d.diubah_at && <span className="small">Terakhir diubah {d.diubah_nama ? `oleh ${d.diubah_nama} ` : ""}{tgl(tglJkt(d.diubah_at))}</span>}
      {(berubah || admin) && (
        <div className="acts">
          {berubah && (
            <button type="button" className="act" disabled={aksi.sibuk}
              onClick={() => aksi.jalankan(() => A.ubahDefect(d.id, { tanggapan }), "Tanggapan disimpan.")}>
              Simpan tanggapan
            </button>
          )}
          {admin && (
            <button type="button" className="act bahaya" disabled={aksi.sibuk}
              onClick={() => confirm("Hapus laporan defect ini beserta fotonya?") && aksi.jalankan(() => A.hapusDefect(d.id), "Defect dihapus.")}>
              Hapus
            </button>
          )}
        </div>
      )}
      </>)}
      </div>
    </details>
  );
}

/* ---------- Info proyek ---------- */
function TabInfo({ proyek, supervisors, klien = [], kunci, aksi }) {
  const [f, setF] = useState({
    nama: proyek.nama, kode: proyek.kode || "", klien_nama: proyek.klien_nama || "", lokasi: proyek.lokasi || "",
    mulai: proyek.mulai, deadline: proyek.deadline || "", supervisor_id: proyek.supervisor_id || "", aktif: proyek.aktif,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [disalin, setDisalin] = useState(false);
  const link = klien[0];
  const url = link ? `${location.origin}/k/${link.id}` : "";
  const pesan = link
    ? `Halo${link.nama ? ` ${link.nama}` : ""}, progres proyek ${proyek.nama} dari Taraco bisa dipantau di link berikut:
${url}`
    : "";

  async function salin() {
    await navigator.clipboard.writeText(url);
    setDisalin(true);
    setTimeout(() => setDisalin(false), 2000);
  }

  return (
    <form className="card stack" onSubmit={(e) => {
      e.preventDefault();
      aksi.jalankan(() => A.ubahProyek(proyek.id, {
        nama: f.nama.trim(), kode: f.kode.trim() || null, klien_nama: f.klien_nama.trim() || null, lokasi: f.lokasi.trim() || null,
        mulai: f.mulai, supervisor_id: f.supervisor_id || null, aktif: f.aktif,
        ...(proyek.deadline ? {} : { deadline: f.deadline || null }),
      }), "Info proyek disimpan.");
    }}>
      {klien.length > 1 && (
        <p className="note b-warn">Proyek ini punya {klien.length} link. Cukup satu; hapus link di sini lalu cek lagi.</p>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label className="lbl" style={{ flex: "1 1 220px", minWidth: 0 }}>Nama proyek<input className="inp" required value={f.nama} onChange={set("nama")} /></label>
        {/* Link klien dibuat dari sini (satu per proyek); memakai Nama klien di bawah. */}
        {!klien.length && !kunci && (
          <button type="button" className="btn" disabled={aksi.sibuk} style={{ width: "auto", flex: "none", padding: "0 20px", whiteSpace: "nowrap" }}
            onClick={() => aksi.jalankan(() => A.buatLink(proyek.id, f.klien_nama.trim()), "Link dibuat. Salin atau kirim lewat WA.")}>
            Buat link klien
          </button>
        )}
        {/* Tombol berupa <a> supaya tetap bisa dipakai saat proyek terkunci (fieldset disabled). */}
        {link && (
          <div className="acts link-klien">
            <a className="act" href={url} onClick={(e) => { e.preventDefault(); salin(); }}>{disalin ? "Tersalin ✓" : "Copy link untuk klien"}</a>
            <a className="act" href={`https://wa.me/?text=${encodeURIComponent(pesan)}`} target="_blank" rel="noreferrer">Kirim WA</a>
            {!kunci && (
              <button type="button" className="act bahaya" disabled={aksi.sibuk}
                onClick={() => confirm("Hapus link klien? Link ini tidak bisa dibuka lagi.") && aksi.jalankan(() => A.cabutLink(link.id), "Link dihapus.")}>
                Hapus
              </button>
            )}
          </div>
        )}
      </div>
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
  const [busy, setBusy] = useState(false);
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
      ({ error } = (await A.hapusProyek(proyek.id)) || {});
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
      <div className="acts">
        <button type="button" className="act" disabled={busy} onClick={() => setBuka(false)}>Batal</button>
        <button type="button" className="act bahaya" disabled={busy} onClick={hapus}>
          {busy ? "Menghapus…" : "Hapus permanen"}
        </button>
      </div>
    </div>
  );
}
