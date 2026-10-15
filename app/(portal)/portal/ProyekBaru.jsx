"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAksi } from "./useAksi";
import { hariIni } from "@/lib/portal/format";
import { bacaBaris, formatLama, infoSheet } from "@/lib/portal/imporBoq";
import { buatProyek, tambahItem } from "./aksi";
import UnggahBoq from "./UnggahBoq";

// "001374 - G Apartment" / "BoQ - DC Apartment" -> nama proyeknya saja.
const namaDariSheet = (s) => s.replace(/^\s*(boq\s*-\s*)?(\d+\s*-\s*)?/i, "").trim() || s.trim();

export default function ProyekBaru({ supervisors }) {
  const router = useRouter();
  const { msg, setMsg } = useAksi();
  const [sibuk, setSibuk] = useState(false);
  const [f, setF] = useState({ nama: "", kode: "", klien_nama: "", lokasi: "", mulai: hariIni(), deadline: "", supervisor_id: "" });
  const [boq, setBoq] = useState(null); // { sheet, items, tebakan } dari file BoQ
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Sheet dipilih: isi form dari kepala surat BoQ dan siapkan itemnya.
  function dariFile(file) {
    if (!file) return setBoq(null);
    setBoq({ sheet: file.sheet, items: bacaBaris(file.rows), tebakan: formatLama(file.rows) });
    setF((lama) => ({ ...lama, nama: namaDariSheet(file.sheet), ...infoSheet(file.rows) }));
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
      // Proyek sudah jadi; kalau itemnya gagal, admin bisa mengimpor ulang di tab Item BOQ.
      const r = await tambahItem(hasil.id, boq.items).catch(() => ({ error: "tidak tersambung ke server" }));
      if (r?.error) alert(`Proyek dibuat, tetapi item BOQ gagal diimpor (${r.error}). Impor ulang dari tab Item BOQ.`);
    }
    router.push(`/portal/proyek/${hasil.id}`);
  }

  return (
    <details className="lipat">
      <summary><b>+ Proyek baru</b></summary>
      <form className="lipat-b" style={{ gap: 12 }} onSubmit={simpan}>
      <p className="small" style={{ margin: 0 }}>
        Pilih file BoQ untuk mengisi data proyek dan item-itemnya sekaligus, atau lewati dan isi manual.
      </p>
      <UnggahBoq onPilih={dariFile} />
      {boq && (
        <p className={`note ${boq.items.length && !boq.tebakan ? "b-ok" : "b-warn"}`}>
          {!boq.items.length
            ? `Tidak ada item yang terbaca di sheet “${boq.sheet}”. Proyek tetap bisa dibuat tanpa item.`
            : boq.tebakan
            ? `${boq.items.length} item dari sheet “${boq.sheet}” akan ikut diimpor. Sheet ini tidak memakai nomor item, jadi item ditebak dari baris yang punya dimensi; periksa hasilnya setelah proyek dibuat.`
            : `${boq.items.length} item di ${new Set(boq.items.map((i) => i.area)).size} area dari sheet “${boq.sheet}” akan ikut diimpor.`}
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
