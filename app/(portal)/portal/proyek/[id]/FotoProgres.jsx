"use client";
import { useCallback, useState } from "react";
import { Pratinjau } from "../../../FotoItem";
import { kompresBanyakGambar } from "@/lib/gambar";
import * as A from "../../aksi";

const MAKS_PER_UNGGAH = 10; // sama dengan app/api/portal/progres-foto
const MAKS_FOTO = 20; // sama dengan MAKS_FOTO_PROGRES di lib/portal/progresFoto.js
const tglJkt = (ts) => new Date(ts).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" });

// Tombol tambah foto progres (kamera atau galeri, boleh banyak). Foto dikompres
// di browser lalu dikirim lewat route (bukan server action, yang dibatasi 1 MB):
// app/api/portal/progres-foto. `ikon` = tombol bulat "+" kecil (dipakai di baris
// item); selain itu tombol "+ Foto". Ketukannya tidak diteruskan ke baris item.
export function TombolFoto({ item, jumlah, aksi, ikon }) {
  const sisa = MAKS_FOTO - jumlah;
  const mati = aksi.sibuk || sisa <= 0;

  async function unggah(e) {
    const files = Array.from(e.target.files || []).slice(0, Math.min(MAKS_PER_UNGGAH, sisa));
    e.target.value = "";
    if (!files.length) return;
    await aksi.jalankan(async () => {
      const fd = new FormData();
      fd.set("item_id", item.id);
      for (const f of await kompresBanyakGambar(files)) fd.append("foto", f);
      const r = await fetch("/api/portal/progres-foto", { method: "POST", body: fd });
      return r.ok ? {} : { error: (await r.json().catch(() => ({}))).error || "foto gagal diunggah." };
    }, files.length > 1 ? `${files.length} foto progres diunggah · ${item.nama}` : `Foto progres diunggah · ${item.nama}`);
  }

  return (
    <label className={ikon ? `fprog-plus${mati ? " mati" : ""}` : `act fprog-tambah${mati ? " mati" : ""}`}
      title="Tambah foto progres" aria-label={`Tambah foto progres ${item.nama}`}
      onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {ikon ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> : "+ Foto"}
      <input type="file" accept="image/*" multiple hidden disabled={mati} onChange={unggah} />
    </label>
  );
}

// Foto progres satu item: galeri, ketuk foto untuk memperbesar. `lihat` = hanya melihat.
export default function FotoProgres({ item, foto, aksi, lihat }) {
  const [buka, setBuka] = useState(null); // indeks foto yang dibesarkan
  const tutup = useCallback(() => setBuka(null), []);

  if (lihat && !foto.length) return null;
  return (
    <div className="fprog">
      <div className="row" style={{ alignItems: "center" }}>
        <div className="fl" style={{ margin: 0 }}>Foto progres{foto.length ? ` (${foto.length})` : ""}</div>
        {!lihat && (
          <label className={`act fprog-tambah${aksi.sibuk || sisa <= 0 ? " mati" : ""}`}>
            + Foto
            <input type="file" accept="image/*" multiple hidden disabled={aksi.sibuk || sisa <= 0} onChange={unggah} />
          </label>
        )}
      </div>
      {foto.length > 0 ? (
        <div className="fprog-grid">
          {foto.map((f, n) => (
            <div key={f.id} className="fprog-sel">
              <button type="button" className="fprog-img" aria-label={`Perbesar foto progres ${n + 1} dari ${foto.length}`} onClick={() => setBuka(n)}>
                <img src={f.url} alt="" loading="lazy" />
                <span>{tglJkt(f.created_at)}</span>
              </button>
              {!lihat && (
                <button type="button" className="fprog-hapus" aria-label="Hapus foto" disabled={aksi.sibuk}
                  onClick={() => confirm("Hapus foto progres ini?") && aksi.jalankan(() => A.hapusFotoProgresItem(f.id), "Foto progres dihapus.")}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="small" style={{ margin: 0 }}>Belum ada foto. Ketuk “+ Foto” untuk menambah (bisa banyak sekaligus).</p>
      )}
      {buka != null && <Pratinjau nama={item.nama} foto={foto.map((f) => f.url)} mulai={buka} tutup={tutup} />}
    </div>
  );
}        {!lihat && <TombolFoto item={item} jumlah={foto.length} aksi={aksi} />}
t";
import { useCallback, useState } from "react";
import { Pratinjau } from "../../../FotoItem";
import { kompresBanyakGambar } from "@/lib/gambar";
import * as A from "../../aksi";

const MAKS_PER_UNGGAH = 10; // sama dengan app/api/portal/progres-foto
const MAKS_FOTO = 20; // sama dengan MAKS_FOTO_PROGRES di lib/portal/progresFoto.js
const tglJkt = (ts) => new Date(ts).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" });

// Tombol tambah foto progres (kamera atau galeri, boleh banyak). Foto dikompres
// di browser lalu dikirim lewat route (bukan server action, yang dibatasi 1 MB):
// app/api/portal/progres-foto. `ikon` = tombol bulat "+" kecil (dipakai di baris
// item); selain itu tombol "+ Foto". Ketukannya tidak diteruskan ke baris item.
export function TombolFoto({ item, jumlah, aksi, ikon }) {
  const sisa = MAKS_FOTO - jumlah;
  const mati = aksi.sibuk || sisa <= 0;

  async function unggah(e) {
    const files = Array.from(e.target.files || []).slice(0, Math.min(MAKS_PER_UNGGAH, sisa));
    e.target.value = "";
    if (!files.length) return;
    await aksi.jalankan(async () => {
      const fd = new FormData();
      fd.set("item_id", item.id);
      for (const f of await kompresBanyakGambar(files)) fd.append("foto", f);
      const r = await fetch("/api/portal/progres-foto", { method: "POST", body: fd });
      return r.ok ? {} : { error: (await r.json().catch(() => ({}))).error || "foto gagal diunggah." };
    }, files.length > 1 ? `${files.length} foto progres diunggah · ${item.nama}` : `Foto progres diunggah · ${item.nama}`);
  }

  return (
    <label className={ikon ? `fprog-plus${mati ? " mati" : ""}` : `act fprog-tambah${mati ? " mati" : ""}`}
      title="Tambah foto progres" aria-label={`Tambah foto progres ${item.nama}`}
      onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {ikon ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> : "+ Foto"}
      <input type="file" accept="image/*" multiple hidden disabled={mati} onChange={unggah} />
    </label>
  );
}

// Foto progres satu item: galeri, ketuk foto untuk memperbesar. `lihat` = hanya melihat.
export default function FotoProgres({ item, foto, aksi, lihat }) {
  const [buka, setBuka] = useState(null); // indeks foto yang dibesarkan
  const tutup = useCallback(() => setBuka(null), []);

  if (lihat && !foto.length) return null;
  return (
    <div className="fprog">
      <div className="row" style={{ alignItems: "center" }}>
        <div className="fl" style={{ margin: 0 }}>Foto progres{foto.length ? ` (${foto.length})` : ""}</div>
        {!lihat && (
          <label className={`act fprog-tambah${aksi.sibuk || sisa <= 0 ? " mati" : ""}`}>
            + Foto
            <input type="file" accept="image/*" multiple hidden disabled={aksi.sibuk || sisa <= 0} onChange={unggah} />
          </label>
        )}
      </div>
      {foto.length > 0 ? (
        <div className="fprog-grid">
          {foto.map((f, n) => (
            <div key={f.id} className="fprog-sel">
              <button type="button" className="fprog-img" aria-label={`Perbesar foto progres ${n + 1} dari ${foto.length}`} onClick={() => setBuka(n)}>
                <img src={f.url} alt="" loading="lazy" />
                <span>{tglJkt(f.created_at)}</span>
              </button>
              {!lihat && (
                <button type="button" className="fprog-hapus" aria-label="Hapus foto" disabled={aksi.sibuk}
                  onClick={() => confirm("Hapus foto progres ini?") && aksi.jalankan(() => A.hapusFotoProgresItem(f.id), "Foto progres dihapus.")}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="small" style={{ margin: 0 }}>Belum ada foto. Ketuk “+ Foto” untuk menambah (bisa banyak sekaligus).</p>
      )}
      {buka != null && <Pratinjau nama={item.nama} foto={foto.map((f) => f.url)} mulai={buka} tutup={tutup} />}
    </div>
  );
}
