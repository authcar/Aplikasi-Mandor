"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAksi } from "./useAksi";
import { hariIni } from "@/lib/portal/format";
import { bacaBaris, bacaBarisJasa, bacaJasa, formatLama, infoSheet } from "@/lib/portal/imporBoq";
import { bukaXlsx } from "@/lib/portal/bacaXlsx";
import { buatProyek, tambahItem } from "./aksi";

// "001374 - G Apartment" / "BoQ - DC Apartment" -> nama proyeknya saja.
const namaDariSheet = (s) => s.replace(/^\s*(boq\s*-\s*)?(\d+\s*-\s*)?/i, "").trim() || s.trim();
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Satu sheet file: { nama, jasa, rows } -> item proyek. Sheet Hitungan Jasa
// Pekerjaan (ada kolom Harga Satuan & Total) ikut membawa harga, total, dan tim.
function itemSheet(x, mulai) {
  if (!x.jasa) return bacaBaris(x.rows, mulai);
  return bacaBarisJasa(x.rows, infoSheet(x.rows).tim, mulai);
}

export default function ProyekBaru({ supervisors }) {
  const router = useRouter();
  const { msg, setMsg } = useAksi();
  const [sibuk, setSibuk] = useState(false);
  const [f, setF] = useState({ nama: "", kode: "", klien_nama: "", lokasi: "", mulai: hariIni(), deadline: "", supervisor_id: "" });
  const [buku, setBuku] = useState(null); // hasil bukaXlsx
  const [dibaca, setDibaca] = useState({}); // { [sheet]: { nama, jasa, rows } } sheet yang sudah dibaca
  const [pilih, setPilih] = useState([]); // sheet tercentang, urut sesuai file
  const [galat, setGalat] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const baca = (b, nama, cache) => {
    if (cache[nama]) return cache[nama];
    const rows = b.baca(nama);
    return (cache[nama] = { nama, rows, jasa: bacaJasa(rows).length > 0 });
  };

  // Beberapa sheet boleh dicentang sekaligus; item semuanya digabung jadi satu proyek.
  const boq = useMemo(() => {
    if (!buku || !pilih.length) return null;
    const items = [];
    for (const s of pilih) items.push(...itemSheet(dibaca[s], items.length));
    return { sheets: pilih, items, tebakan: pilih.some((s) => !dibaca[s].jasa && formatLama(dibaca[s].rows)) };
  }, [buku, pilih, dibaca]);

  // Form diisi dari kepala surat sheet pertama yang dicentang.
  function isiForm(x) {
    const { tim, ...info } = infoSheet(x.rows);
    setF((lama) => ({ ...lama, nama: namaDariSheet(x.nama.replace(/\s*\([^)]*\)\s*$/, "")), ...info }));
  }

  function centang(b, nama, on, cache = { ...dibaca }) {
    const x = baca(b, nama, cache);
    setDibaca(cache);
    const baru = b.sheets.filter((s) => (s === nama ? on : pilih.includes(s)));
    setPilih(baru);
    if (on && baru[0] === nama) isiForm(x);
  }

  async function pilihFile(e) {
    const file = e.target.files?.[0];
    setGalat("");
    setBuku(null);
    setDibaca({});
    setPilih([]);
    if (!file) return;
    try {
      const b = bukaXlsx(await file.arrayBuffer());
      if (!b.sheets.length) throw new Error();
      setBuku(b);
      // File kecil (mis. jasa tukang per tim): semua sheet berisi item langsung dicentang.
      // File BoQ besar (puluhan sheet): hanya sheet yang namanya mirip proyek.
      const cache = {};
      let awal = [];
      if (b.sheets.length <= 6) {
        awal = b.sheets.filter((s) => { const x = baca(b, s, cache); return x.jasa || bacaBaris(x.rows).length; });
      }
      if (!awal.length && b.sheets.length === 1) awal = b.sheets;
      setDibaca(cache);
      setPilih(awal);
      if (awal.length) isiForm(baca(b, awal[0], cache));
    } catch {
      setGalat("File tidak bisa dibaca. Pastikan formatnya Excel .xlsx (bukan .xls atau PDF).");
    }
  }

  async function simpan(e) {
    e.preventDefault();
    setMsg("");
    setSibuk(true);
    let hasil;
    try {
      hasil = await buatProyek({
        nama: f.nama.trim(),
        kode: f.kode.trim() || null,
        klien_nama: f.klien_nama.trim() || null,
        lokasi: f.lokasi.trim() || null,
        mulai: f.mulai,
        deadline: f.deadline || null,
        supervisor_id: f.supervisor_id || null,
      });
    } catch {
      hasil = { error: "tidak tersambung ke server. Periksa koneksi lalu coba lagi." };
    }
    if (hasil?.error || !hasil?.id) {
      setSibuk(false);
      return setMsg(`Gagal: ${hasil?.error || "proyek tidak tersimpan."}`);
    }
    if (boq?.items.length) {
      // Proyek sudah jadi; kalau itemnya gagal, admin bisa mengimpor ulang di tab Jasa tukang.
      const r = await tambahItem(hasil.id, boq.items).catch(() => ({ error: "tidak tersambung ke server" }));
      if (r?.error) alert(`Proyek dibuat, tetapi item BOQ gagal diimpor (${r.error}). Impor ulang dari tab Jasa tukang.`);
    }
    router.push(`/portal/proyek/${hasil.id}`);
  }

  return (
    <details className="lipat">
      <summary><b>+ Proyek baru</b></summary>
      <form className="lipat-b" style={{ gap: 12 }} onSubmit={simpan}>
      <p className="small" style={{ margin: 0 }}>
        Pilih file BoQ atau Hitungan Jasa Pekerjaan untuk mengisi data proyek dan item-itemnya sekaligus, atau lewati
        dan isi manual. Beberapa sheet boleh dicentang sekaligus; itemnya digabung jadi satu proyek.
      </p>
      <label className="lbl">File Excel (.xlsx)
        <input className="inp" type="file" style={{ padding: "9px 12px" }} onChange={pilihFile}
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
      </label>
      {galat && <p className="note b-bad">{galat}</p>}
      {buku && (
        <div className="stack" style={{ gap: 0 }}>
          <div className="fl" style={{ margin: 0 }}>Sheet ({pilih.length} dari {buku.sheets.length} dicentang)</div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {buku.sheets.map((s) => (
              <label key={s} className="cek">
                <input type="checkbox" checked={pilih.includes(s)} onChange={(e) => centang(buku, s, e.target.checked)} />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s}{dibaca[s] && pilih.includes(s) ? ` · ${itemSheet(dibaca[s], 0).length} item${dibaca[s].jasa ? " + jasa tukang" : ""}` : ""}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      {boq && (
        <p className={`note ${boq.items.length && !boq.tebakan ? "b-ok" : "b-warn"}`}>
          {!boq.items.length
            ? `Tidak ada item yang terbaca di sheet yang dicentang. Proyek tetap bisa dibuat tanpa item.`
            : `${boq.items.length} item di ${new Set(boq.items.map((i) => i.area)).size} area dari ${boq.sheets.length} sheet akan ikut diimpor.` +
              (boq.items.some((i) => i.tim) ? ` Harga satuan, total jasa, dan tim tukang ikut terisi.` : "") +
              (boq.tebakan ? " Ada sheet tanpa nomor item, jadi item ditebak dari baris yang punya dimensi; periksa hasilnya setelah proyek dibuat." : "")}
        </p>
      )}
      <label className="lbl">Nama proyek<input className="inp" required value={f.nama} onChange={set("nama")} placeholder="AF House" /></label>
      <div className="g2">
        <label className="lbl">Kode / No. order<input className="inp" value={f.kode} onChange={set("kode")} placeholder="001386" /></label>
        <label className="lbl">Nama klien<input className="inp" value={f.klien_nama} onChange={set("klien_nama")} placeholder="Bpk. Alfeus" /></label>
      </div>
      <label className="lbl">Lokasi<input className="inp" value={f.lokasi} onChange={set("lokasi")} placeholder="Cluster Viola, Bekasi" /></label>
      <div className="g2">
        <label className="lbl">Mulai<input className="inp" type="date" required value={f.mulai} onChange={set("mulai")} /></label>
        <label className="lbl">Deadline<input className="inp" type="date" value={f.deadline} onChange={set("deadline")} min={f.mulai} /></label>
      </div>
      <p className="small" style={{ margin: 0 }}>
        Deadline tidak bisa diubah setelah disimpan. Setelah lewat deadline, proyek terkunci.
      </p>
      <label className="lbl">
        Supervisor
        <select className="inp" value={f.supervisor_id} onChange={set("supervisor_id")}>
          <option value="">— Belum ditentukan —</option>
          {supervisors.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>
      </label>
      {msg && <p className="note b-bad">{msg}</p>}
      <button className="btn" disabled={sibuk || !f.nama.trim()}>{sibuk ? "Menyimpan…" : boq?.items.length ? `Buat proyek + ${boq.items.length} item` : "Buat proyek"}</button>
      </form>
    </details>
  );
}
