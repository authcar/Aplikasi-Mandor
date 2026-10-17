"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { kompresBanyakGambar } from "@/lib/gambar";
import { tgl, tglTh, STATUS_DEFECT } from "@/lib/portal/format";

const MAKS_FOTO = 5; // sama dengan MAKS_FOTO_DEFECT di lib/portal/defect.js
// Timestamp -> "YYYY-MM-DD" waktu Jakarta.
const tglJkt = (ts) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

// Tab Defect di halaman klien: form keluhan (bisa beberapa item sekaligus;
// tiap baris = item opsional, keterangan, foto) dan daftar keluhan yang sudah
// dikirim beserta status & tanggapan tim. Tiap baris dikirim terpisah ke
// app/api/portal/defect (multipart), jadi tiap keluhan punya status sendiri.
let nomor = 0;
const barisBaru = () => ({ id: ++nomor, itemId: "", ket: "", foto: [] }); // foto: [{ file, url }]
const lepas = (foto) => foto.forEach((f) => URL.revokeObjectURL(f.url));

export default function Defect({ items, defect }) {
  const { token } = useParams();
  const router = useRouter();
  const [baris, setBaris] = useState(() => [barisBaru()]);
  const [busy, setBusy] = useState("");
  const [pesan, setPesan] = useState(null); // [teks, kelas]
  const [bukaLaporan, setBukaLaporan] = useState(false);
  const belumSelesai = defect.filter((d) => d.status !== "SELESAI").length;
  // Lepas pratinjau foto yang masih ada saat tab ditutup.
  const sekarang = useRef(baris);
  sekarang.current = baris;
  useEffect(() => () => sekarang.current.forEach((b) => lepas(b.foto)), []);

  const areas = [...new Set(items.map((i) => i.area))];
  const namaItem = Object.fromEntries(items.map((i) => [i.id, i.nama]));
  const ubah = (id, patch) => setBaris((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const hapusBaris = (id) =>
    setBaris((bs) => {
      lepas(bs.find((b) => b.id === id)?.foto || []);
      return bs.filter((b) => b.id !== id);
    });

  async function tambahFoto(id, e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const sisa = MAKS_FOTO - (baris.find((b) => b.id === id)?.foto.length || 0);
    if (files.length > sisa) setPesan([`Maksimal ${MAKS_FOTO} foto per item. ${files.length - sisa} foto tidak ditambahkan.`, "b-warn"]);
    // Dikompres di HP dulu (1600px) supaya cepat terkirim lewat sinyal lemah.
    setBusy("Menyiapkan foto…");
    const siap = await kompresBanyakGambar(files.slice(0, Math.max(0, sisa)));
    setBusy("");
    setBaris((bs) => bs.map((b) => (b.id === id ? { ...b, foto: [...b.foto, ...siap.map((file) => ({ file, url: URL.createObjectURL(file) }))] } : b)));
  }

  function hapusFoto(id, n) {
    setBaris((bs) =>
      bs.map((b) => {
        if (b.id !== id) return b;
        lepas([b.foto[n]]);
        return { ...b, foto: b.foto.filter((_, k) => k !== n) };
      })
    );
  }

  async function kirim(e) {
    e.preventDefault();
    const isi = baris.filter((b) => b.ket.trim() || b.foto.length || b.itemId);
    if (!isi.length) return setPesan(["Tuliskan keterangan keluhannya dulu.", "b-warn"]);
    const kosong = isi.findIndex((b) => !b.ket.trim());
    if (kosong >= 0) return setPesan([`Keterangan item ${baris.indexOf(isi[kosong]) + 1} belum diisi.`, "b-warn"]);
    setPesan(null);
    // Dikirim satu per satu; yang berhasil keluar dari form, yang gagal tetap
    // di form supaya bisa dikirim ulang tanpa mengetik lagi.
    let terkirim = 0;
    let error;
    for (const b of isi) {
      setBusy(isi.length > 1 ? `Mengirim ${terkirim + 1} dari ${isi.length}…` : "Mengirim…");
      const fd = new FormData();
      fd.set("token", token);
      fd.set("keterangan", b.ket.trim());
      if (b.itemId) fd.set("item_id", b.itemId);
      b.foto.forEach((f) => fd.append("foto", f.file));
      try {
        const r = await fetch("/api/portal/defect", { method: "POST", body: fd });
        error = r.ok ? null : (await r.json().catch(() => ({}))).error || "gagal mengirim.";
      } catch {
        error = "tidak tersambung ke server. Periksa koneksi lalu coba lagi.";
      }
      if (error) break;
      terkirim++;
      lepas(b.foto);
      setBaris((bs) => bs.filter((x) => x.id !== b.id));
    }
    setBusy("");
    // Semua terkirim -> form kembali ke satu baris kosong.
    if (!error) setBaris((bs) => (bs.length ? bs : [barisBaru()]));
    if (terkirim) {
      setBukaLaporan(true);
      router.refresh();
    }
    if (error)
      return setPesan([`${terkirim ? `${terkirim} keluhan terkirim. ` : ""}Gagal: ${error}`, "b-bad"]);
    setPesan([
      `Terima kasih, ${terkirim > 1 ? `${terkirim} keluhan` : "keluhan"} Anda sudah kami terima dan akan segera ditindaklanjuti.`,
      "b-ok",
    ]);
  }

  return (
    <>
      <form className="card stack" onSubmit={kirim}>
        <div>
          <h3>Laporkan defect</h3>
          <p className="small" style={{ margin: "4px 0 0" }}>
            Ada bagian yang kurang rapi atau rusak? Ceritakan dan lampirkan foto, tim kami akan menindaklanjuti.
            Bisa beberapa item sekaligus.
          </p>
        </div>
        {baris.map((b, n) => (
          <fieldset key={b.id} className="defect-baris" disabled={!!busy}>
            {baris.length > 1 && (
              <div className="row" style={{ alignItems: "center" }}>
                <b className="small" style={{ fontWeight: 700 }}>Item {n + 1}</b>
                <button type="button" className="act" onClick={() => hapusBaris(b.id)}>Hapus</button>
              </div>
            )}
            <label className="lbl">Item (opsional)
              <select className="inp" value={b.itemId} onChange={(e) => ubah(b.id, { itemId: e.target.value })}>
                <option value="">Umum / tidak spesifik</option>
                {areas.map((a) => (
                  <optgroup key={a} label={a}>
                    {items.filter((i) => i.area === a).map((i) => <option key={i.id} value={i.id}>{i.nama}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="lbl">Keterangan
              <textarea className="inp teks" rows={3} maxLength={1000} value={b.ket} onChange={(e) => ubah(b.id, { ket: e.target.value })}
                placeholder="Contoh: pintu kabinet bawah wastafel tidak menutup rapat." />
            </label>
            <div className="lbl" style={{ gap: 8 }}>Foto ({b.foto.length}/{MAKS_FOTO})
              <div className="foto-grid">
                {b.foto.map((f, k) => (
                  <span key={f.url} className="foto">
                    <img src={f.url} alt={`Foto ${k + 1}`} />
                    <button type="button" className="foto-x" aria-label={`Hapus foto ${k + 1}`} onClick={() => hapusFoto(b.id, k)}>×</button>
                  </span>
                ))}
                {b.foto.length < MAKS_FOTO && (
                  <label className="foto tambah">
                    <span aria-hidden="true">+</span>
                    <span className="sr">Tambah foto</span>
                    <input type="file" accept="image/*" multiple hidden onChange={(e) => tambahFoto(b.id, e)} />
                  </label>
                )}
              </div>
            </div>
          </fieldset>
        ))}
        <button type="button" className="act tambah-baris" disabled={!!busy} onClick={() => setBaris((bs) => [...bs, barisBaru()])}>
          + Tambah item lain
        </button>
        {pesan && <p className={`note ${pesan[1]}`}>{pesan[0]}</p>}
        <button className="btn" disabled={!!busy}>
          {busy || (baris.length > 1 ? `Kirim ${baris.length} laporan` : "Kirim laporan")}
        </button>
      </form>

      {/* Daftar laporan bisa dibuka-tutup; terbuka sendiri setelah laporan baru terkirim. */}
      {defect.length > 0 && (
        <details className="lipat" open={bukaLaporan} onToggle={(e) => setBukaLaporan(e.currentTarget.open)}>
          <summary>
            <span style={{ minWidth: 0, flex: 1 }}>
              <h2>Laporan Anda</h2>
              <span className="small">
                {defect.length} laporan
                {belumSelesai ? ` · ${belumSelesai} belum selesai` : " · semua selesai"}
              </span>
            </span>
          </summary>
          <div className="lipat-b" style={{ gap: 8 }}>
          {defect.map((d) => {
            const [lab, cls] = STATUS_DEFECT[d.status] || STATUS_DEFECT.BARU;
            return (
              <div key={d.id} className="defect-baris" style={{ gap: 8 }}>
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
                {(d.tanggapan || d.foto_tanggapan?.length > 0) && (
                  <div className="note b-n stack" style={{ gap: 8 }}>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      <b>Tanggapan tim{d.diubah_at ? ` · ${tgl(tglJkt(d.diubah_at))}` : ""}:</b> {d.tanggapan}
                    </p>
                    {d.foto_tanggapan?.length > 0 && (
                      <div className="foto-grid">
                        {d.foto_tanggapan.map((u, n) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer" className="foto"><img src={u} alt={`Foto tanggapan ${n + 1}`} /></a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </details>
      )}
    </>
  );
}
