"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { kompresBanyakGambar } from "@/lib/gambar";
import { tgl, tglTh, STATUS_DEFECT } from "@/lib/portal/format";

const MAKS_FOTO = 5; // sama dengan MAKS_FOTO_DEFECT di lib/portal/defect.js
// Timestamp -> "YYYY-MM-DD" waktu Jakarta.
const tglJkt = (ts) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

// Tab Defect di halaman klien: form keluhan (item opsional, keterangan, foto)
// dan daftar keluhan yang sudah dikirim beserta status & tanggapan tim.
// Dikirim ke app/api/portal/defect (multipart).
export default function Defect({ items, defect }) {
  const { token } = useParams();
  const router = useRouter();
  const [itemId, setItemId] = useState("");
  const [ket, setKet] = useState("");
  const [foto, setFoto] = useState([]); // [{ file, url }]
  const [busy, setBusy] = useState("");
  const [pesan, setPesan] = useState(null); // [teks, kelas]
  useEffect(() => () => foto.forEach((f) => URL.revokeObjectURL(f.url)), [foto]);

  const areas = [...new Set(items.map((i) => i.area))];
  const namaItem = Object.fromEntries(items.map((i) => [i.id, i.nama]));

  async function tambahFoto(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const sisa = MAKS_FOTO - foto.length;
    if (files.length > sisa) setPesan([`Maksimal ${MAKS_FOTO} foto. ${files.length - sisa} foto tidak ditambahkan.`, "b-warn"]);
    // Dikompres di HP dulu (1600px) supaya cepat terkirim lewat sinyal lemah.
    setBusy("Menyiapkan foto…");
    const siap = await kompresBanyakGambar(files.slice(0, Math.max(0, sisa)));
    setBusy("");
    setFoto((f) => [...f, ...siap.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  async function kirim(e) {
    e.preventDefault();
    if (!ket.trim()) return setPesan(["Tuliskan keterangan keluhannya dulu.", "b-warn"]);
    const fd = new FormData();
    fd.set("token", token);
    fd.set("keterangan", ket.trim());
    if (itemId) fd.set("item_id", itemId);
    foto.forEach((f) => fd.append("foto", f.file));
    setBusy("Mengirim…");
    setPesan(null);
    let error;
    try {
      const r = await fetch("/api/portal/defect", { method: "POST", body: fd });
      error = r.ok ? null : (await r.json().catch(() => ({}))).error || "gagal mengirim.";
    } catch {
      error = "tidak tersambung ke server. Periksa koneksi lalu coba lagi.";
    }
    setBusy("");
    if (error) return setPesan([`Gagal: ${error}`, "b-bad"]);
    setItemId("");
    setKet("");
    setFoto([]);
    setPesan(["Terima kasih, keluhan Anda sudah kami terima dan akan segera ditindaklanjuti.", "b-ok"]);
    router.refresh();
  }

  return (
    <>
      <form className="card stack" onSubmit={kirim}>
        <div>
          <h3>Laporkan defect</h3>
          <p className="small" style={{ margin: "4px 0 0" }}>
            Ada bagian yang kurang rapi atau rusak? Ceritakan dan lampirkan foto, tim kami akan menindaklanjuti.
          </p>
        </div>
        <label className="lbl">Item (opsional)
          <select className="inp" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Umum / tidak spesifik</option>
            {areas.map((a) => (
              <optgroup key={a} label={a}>
                {items.filter((i) => i.area === a).map((i) => <option key={i.id} value={i.id}>{i.nama}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="lbl">Keterangan
          <textarea className="inp teks" rows={4} maxLength={1000} value={ket} onChange={(e) => setKet(e.target.value)}
            placeholder="Contoh: pintu kabinet bawah wastafel tidak menutup rapat." />
        </label>
        <div className="lbl" style={{ gap: 8 }}>Foto ({foto.length}/{MAKS_FOTO})
          <div className="foto-grid">
            {foto.map((f, n) => (
              <span key={f.url} className="foto">
                <img src={f.url} alt={`Foto ${n + 1}`} />
                <button type="button" className="foto-x" aria-label={`Hapus foto ${n + 1}`}
                  onClick={() => setFoto((x) => x.filter((_, k) => k !== n))}>×</button>
              </span>
            ))}
            {foto.length < MAKS_FOTO && (
              <label className="foto tambah">
                <span aria-hidden="true">+</span>
                <span className="sr">Tambah foto</span>
                <input type="file" accept="image/*" multiple hidden onChange={tambahFoto} />
              </label>
            )}
          </div>
        </div>
        {pesan && <p className={`note ${pesan[1]}`}>{pesan[0]}</p>}
        <button className="btn" disabled={!!busy}>{busy || "Kirim laporan"}</button>
      </form>

      {defect.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="area"><h2>Laporan Anda</h2><span className="num small">{defect.length}</span></div>
          {defect.map((d) => {
            const [lab, cls] = STATUS_DEFECT[d.status] || STATUS_DEFECT.BARU;
            return (
              <div key={d.id} className="card stack" style={{ gap: 8 }}>
                <div className="row" style={{ alignItems: "center" }}>
                  <span className="small">{tglTh(tglJkt(d.created_at))}{d.item_id && namaItem[d.item_id] ? ` · ${namaItem[d.item_id]}` : ""}</span>
                  <span className={`badge ${cls}`}>{lab}</span>
                </div>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{d.keterangan}</p>
                {d.foto.length > 0 && (
                  <div className="foto-grid">
                    {d.foto.map((u, n) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="foto"><img src={u} alt={`Foto ${n + 1}`} /></a>
                    ))}
                  </div>
                )}
                {d.tanggapan && (
                  <p className="note b-n" style={{ whiteSpace: "pre-wrap" }}>
                    <b>Tanggapan tim{d.diubah_at ? ` · ${tgl(tglJkt(d.diubah_at))}` : ""}:</b> {d.tanggapan}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
