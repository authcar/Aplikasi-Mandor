"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAksi } from "./useAksi";
import { hariIni } from "@/lib/portal/format";
import { buatProyek } from "./aksi";

export default function ProyekBaru({ supervisors }) {
  const router = useRouter();
  const { msg, setMsg } = useAksi();
  const [sibuk, setSibuk] = useState(false);
  const [f, setF] = useState({ nama: "", kode: "", klien_nama: "", lokasi: "", mulai: hariIni(), deadline: "", supervisor_id: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

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
    router.push(`/portal/proyek/${hasil.id}`);
  }

  return (
    <details className="lipat">
      <summary><b>+ Proyek baru</b></summary>
      <form className="lipat-b" style={{ gap: 12 }} onSubmit={simpan}>
      <label className="lbl">Nama proyek<input className="inp" required value={f.nama} onChange={set("nama")} placeholder="AF House" /></label>
      <div className="g2">
        <label className="lbl">Kode / No. order<input className="inp" value={f.kode} onChange={set("kode")} placeholder="001386" /></label>
        <label className="lbl">Nama klien<input className="inp" value={f.klien_nama} onChange={set("klien_nama")} placeholder="Bpk. Alfeus" /></label>
      </div>
      <label className="lbl">Lokasi<input className="inp" value={f.lokasi} onChange={set("lokasi")} placeholder="Cluster Viola, Bekasi" /></label>
      <div className="g2">
        <label className="lbl">Mulai<input className="inp" type="date" required value={f.mulai} onChange={set("mulai")} /></label>
        <label className="lbl">Deadline<input className="inp" type="date" value={f.deadline} onChange={set("deadline")} /></label>
      </div>
      <label className="lbl">
        Supervisor
        <select className="inp" value={f.supervisor_id} onChange={set("supervisor_id")}>
          <option value="">— Belum ditentukan —</option>
          {supervisors.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
        </select>
      </label>
      {msg && <p className="note b-bad">{msg}</p>}
      <button className="btn" disabled={sibuk || !f.nama.trim()}>{sibuk ? "Menyimpan…" : "Buat proyek"}</button>
      </form>
    </details>
  );
}
