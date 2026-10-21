"use client";
import { useCallback, useState } from "react";
import { Pratinjau } from "../../../FotoItem";
import { kompresBanyakGambar } from "@/lib/gambar";
import { tahapItem } from "@/lib/portal/progresBoq";
import * as A from "../../aksi";

const MAKS_PER_UNGGAH = 10; // sama dengan app/api/portal/progres-foto
const MAKS_FOTO = 20; // sama dengan MAKS_FOTO_PROGRES di lib/portal/progresFoto.js
const tglJkt = (ts) => new Date(ts).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" });

// Tombol tambah foto progres (kamera atau galeri, boleh banyak). Foto dikompres
// di browser lalu dikirim lewat route (bukan server action, yang dibatasi 1 MB):
// app/api/portal/progres-foto. Tiga bentuk:
//  - ikon: tombol bulat di baris item (foto umum, tanpa tahap); jadi centang hijau kalau item sudah punya foto.
//  - tahap: ikon kamera kecil di baris tahap; foto tercatat untuk tahap itu. `n` = jumlah foto tahap itu.
// Ketukannya tidak diteruskan ke baris item.
export function TombolFoto({ item, jumlah, aksi, ikon, tahap, n = 0 }) {
  const sisa = MAKS_FOTO - jumlah;
  const mati = aksi.sibuk || sisa <= 0;

  async function unggah(e) {
    const files = Array.from(e.target.files || []).slice(0, Math.min(MAKS_PER_UNGGAH, sisa));
    e.target.value = "";
    if (!files.length) return;
    await aksi.jalankan(async () => {
      const fd = new FormData();
      fd.set("item_id", item.id);
      if (tahap) fd.set("tahap", tahap.k);
      for (const f of await kompresBanyakGambar(files)) fd.append("foto", f);
      const r = await fetch("/api/portal/progres-foto", { method: "POST", body: fd });
      return r.ok ? {} : { error: (await r.json().catch(() => ({}))).error || "foto gagal diunggah." };
    }, `${files.length > 1 ? `${files.length} foto` : "Foto"} ${tahap ? tahap.label.toLowerCase() : "progres"} diunggah · ${item.nama}`);
  }

  const kelas = tahap ? `fprog-cam${n > 0 ? " ada" : ""}` : `fprog-plus${jumlah > 0 ? " ada" : ""}`;
  const judul = tahap ? `Foto ${tahap.label}` : "foto progres";
  return (
    <label className={`${kelas}${mati ? " mati" : ""}`}
      title={(tahap ? n : jumlah) > 0 ? `${tahap ? n : jumlah} ${judul} · ketuk untuk menambah` : `Tambah ${judul}`}
      aria-label={`Tambah ${judul} ${item.nama}${(tahap ? n : jumlah) > 0 ? ` (sudah ${tahap ? n : jumlah})` : ""}`}
      onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {tahap ? (
        <>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4zM12 16.5a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" /></svg>
          {n > 0 && <b>{n}</b>}
        </>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={jumlah > 0 ? "M5 12.5l4.5 4.5L19 7.5" : "M12 5v14M5 12h14"} /></svg>
      )}
      <input type="file" accept="image/*" multiple hidden disabled={mati} onChange={unggah} />
    </label>
  );
}

// Foto progres satu item dalam satu baris yang bisa digeser: urut menurut
// tahap, tiap foto diberi nama tahapnya. Foto lama tanpa tahap bisa dikaitkan ke
// tahap lewat pilihan kecil di fotonya. `lihat` = hanya melihat.
export default function FotoProgres({ item, foto, aksi, lihat }) {
  const [buka, setBuka] = useState(null); // indeks foto yang dibesarkan
  const tutup = useCallback(() => setBuka(null), []);
  if (!foto.length) return null;

  const tahap = tahapItem(item);
  const urut = (f) => (f.tahap ? tahap.findIndex((s) => s.k === f.tahap) : 99);
  const daftar = [...foto].sort((a, b) => urut(a) - urut(b) || a.created_at.localeCompare(b.created_at));
  const namaTahap = (f) => tahap.find((s) => s.k === f.tahap)?.label;

  return (
    <div className="fprog">
      <div className="fl" style={{ margin: 0 }}>Foto progres ({foto.length})</div>
      <div className="fprog-strip">
        {daftar.map((f, n) => (
          <div key={f.id} className="fprog-sel">
            <button type="button" className="fprog-img" title={`${namaTahap(f) || "Tanpa tahap"} · ${tglJkt(f.created_at)}`}
              aria-label={`Perbesar foto ${n + 1} dari ${foto.length}, ${namaTahap(f) || "tanpa tahap"}`} onClick={() => setBuka(n)}>
              <img src={f.url} alt="" loading="lazy" />
              {(f.tahap || lihat) && <span>{namaTahap(f) || "Tanpa tahap"}</span>}
            </button>
            {!f.tahap && !lihat && (
              <select className="fprog-tag" value="" aria-label="Pilih tahap foto ini" disabled={aksi.sibuk}
                onChange={(e) => e.target.value && aksi.jalankan(() => A.tandaiFotoProgres(f.id, e.target.value), `Foto ditandai ${tahap.find((s) => s.k === e.target.value).label}.`)}>
                <option value="">Tahap…</option>
                {tahap.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}
              </select>
            )}
            {!lihat && (
              <button type="button" className="fprog-hapus" aria-label="Hapus foto" disabled={aksi.sibuk}
                onClick={() => confirm("Hapus foto progres ini?") && aksi.jalankan(() => A.hapusFotoProgresItem(f.id), "Foto progres dihapus.")}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {buka != null && <Pratinjau nama={item.nama} foto={daftar.map((f) => f.url)} mulai={buka} tutup={tutup} />}
    </div>
  );
}
