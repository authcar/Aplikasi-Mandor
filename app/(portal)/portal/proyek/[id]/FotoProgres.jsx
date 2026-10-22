"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pratinjau } from "../../../FotoItem";
import { kompresBanyakGambar } from "@/lib/gambar";
import { tahapItem, tahapTerakhir } from "@/lib/portal/progresBoq";
import * as A from "../../aksi";

const MAKS_PER_UNGGAH = 10; // sama dengan app/api/portal/progres-foto
const MAKS_FOTO = 20; // sama dengan MAKS_FOTO_PROGRES di lib/portal/progresFoto.js
const tglJkt = (ts) => new Date(ts).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" });
const berhenti = (e) => e.stopPropagation();

// Unggah foto progres satu item (opsional per tahap) lewat route; dipakai form galeri dan FotoWajib.
export async function kirimFoto(itemId, tahap, files) {
  const fd = new FormData();
  fd.set("item_id", itemId);
  if (tahap) fd.set("tahap", tahap);
  for (const f of await kompresBanyakGambar(files)) fd.append("foto", f);
  const r = await fetch("/api/portal/progres-foto", { method: "POST", body: fd });
  return r.ok ? {} : { error: (await r.json().catch(() => ({}))).error || "foto gagal diunggah." };
}

// Pop up foto WAJIB: tahap baru boleh dicatat setelah minimal 1 foto diunggah (boleh banyak).
// Foto diunggah dulu, lalu tahapnya dicatat dalam satu aksi.
export function FotoWajib({ item, s, persen, sisa, aksi, tutup }) {
  const [files, setFiles] = useState([]);
  const input = useRef(null);
  const pratinjau = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => pratinjau.forEach((u) => URL.revokeObjectURL(u)), [pratinjau]);
  const pilihFile = (e) => {
    const baru = Array.from(e.target.files || []);
    e.target.value = "";
    setFiles((lama) => [...lama, ...baru].slice(0, Math.min(MAKS_PER_UNGGAH, sisa)));
  };
  async function simpan() {
    const ok = await aksi.jalankan(async () => {
      const r = await kirimFoto(item.id, s.k, files);
      return r.error ? r : A.setProgres(item.id, s.k, persen);
    }, `${s.label} ${persen >= 100 ? "✓" : `${persen}%`} · ${item.nama} · ${files.length} foto`);
    if (ok) tutup();
  }
  return createPortal(
    <div className="fmodal" role="dialog" aria-modal="true" aria-label={`Foto wajib ${s.label}`} onClick={tutup}>
      <div className="fbox" onClick={berhenti}>
        <div className="fhead">
          <b>Foto {s.label} · {item.nama}</b>
          <button type="button" aria-label="Tutup" onClick={tutup}>×</button>
        </div>
        <div className="fprog-body">
          <div className="fprog-form">
            <p className="small" style={{ margin: 0 }}>
              Unggah minimal <b>1 foto</b> untuk mencatat tahap <b>{s.label}</b>. Boleh lebih dari satu (maks. {Math.min(MAKS_PER_UNGGAH, sisa)}).
            </p>
            <button type="button" className="act" disabled={aksi.sibuk || sisa <= files.length} onClick={() => input.current?.click()}>
              📷 {files.length ? "Tambah foto lagi" : "Pilih foto"}
            </button>
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={pilihFile} />
            {files.length > 0 && (
              <div className="fprog-pv">
                {pratinjau.map((u, n) => (
                  <span key={u}>
                    <img src={u} alt="" />
                    <button type="button" aria-label="Buang foto ini" onClick={() => setFiles(files.filter((_, k) => k !== n))}>×</button>
                  </span>
                ))}
              </div>
            )}
            <button type="button" className="btn" disabled={aksi.sibuk || !files.length} onClick={simpan}>
              {files.length ? `Unggah ${files.length} foto & catat ${s.label}` : "Pilih foto dulu"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Foto progres di baris item. Belum ada foto: tombol "+" bulat. Sudah ada: foto
// terbaru sebagai gambar mini (dengan lambang "+" kalau lebih dari satu). Keduanya
// membuka pop up: galeri foto item (berlabel tahap) dan, untuk staf, form unggah
// banyak foto sekaligus dengan pilihan tahap. `lihat` = hanya melihat (tukang).
// Ketukan di sini tidak diteruskan ke baris item (akordeon).
export default function FotoProgres({ item, foto, aksi, lihat }) {
  const [buka, setBuka] = useState(false);
  const tutup = useCallback(() => setBuka(false), []);
  if (lihat && !foto.length) return null;
  const terbaru = foto[foto.length - 1];

  return (
    <span onClick={berhenti} onKeyDown={berhenti} style={{ display: "contents" }}>
      <button type="button" className={`fprog-pic${terbaru ? " ada" : ""}`}
        aria-label={terbaru ? `${foto.length} foto progres ${item.nama}` : `Tambah foto progres ${item.nama}`}
        title={terbaru ? `${foto.length} foto progres` : "Tambah foto progres"} onClick={() => setBuka(true)}>
        {terbaru ? (
          <>
            <img src={terbaru.url} alt="" loading="lazy" />
            {foto.length > 1 && <span className="fprog-lagi" aria-hidden="true">+</span>}
          </>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        )}
      </button>
      {buka && <PopupFoto item={item} foto={foto} aksi={aksi} lihat={lihat} tutup={tutup} />}
    </span>
  );
}

function PopupFoto({ item, foto, aksi, lihat, tutup }) {
  const tahap = tahapItem(item);
  const urut = (f) => (f.tahap ? tahap.findIndex((s) => s.k === f.tahap) : 99);
  const daftar = useMemo(
    () => [...foto].sort((a, b) => urut(a) - urut(b) || a.created_at.localeCompare(b.created_at)),
    [foto] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const namaTahap = (f) => tahap.find((s) => s.k === f.tahap)?.label;
  const [besar, setBesar] = useState(null); // indeks foto yang dibesarkan
  const tutupBesar = useCallback(() => setBesar(null), []);
  const [files, setFiles] = useState([]);
  const [pilih, setPilih] = useState(tahapTerakhir(item)?.k || ""); // "" = umum (tanpa tahap)
  const input = useRef(null);
  const sisa = MAKS_FOTO - foto.length;
  const pratinjau = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => pratinjau.forEach((u) => URL.revokeObjectURL(u)), [pratinjau]);

  useEffect(() => {
    const tombol = (e) => e.key === "Escape" && besar == null && tutup();
    const tahan = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", tombol);
    return () => {
      document.body.style.overflow = tahan;
      window.removeEventListener("keydown", tombol);
    };
  }, [besar, tutup]);

  const pilihFile = (e) => {
    const baru = Array.from(e.target.files || []);
    e.target.value = "";
    setFiles((lama) => [...lama, ...baru].slice(0, Math.min(MAKS_PER_UNGGAH, sisa)));
  };

  async function unggah() {
    const ok = await aksi.jalankan(async () => {
      return kirimFoto(item.id, pilih, files);
    }, `${files.length} foto ${pilih ? tahap.find((s) => s.k === pilih).label.toLowerCase() : "progres"} diunggah · ${item.nama}`);
    if (ok) setFiles([]);
  }

  return createPortal(
    <div className="fmodal" role="dialog" aria-modal="true" aria-label={`Foto progres ${item.nama}`} onClick={tutup}>
      <div className="fbox" onClick={berhenti}>
        <div className="fhead">
          <b>Foto progres · {item.nama}</b>
          <button type="button" aria-label="Tutup" onClick={tutup}>×</button>
        </div>
        <div className="fprog-body">
          {daftar.length > 0 && (
            <div className="fprog-grid">
              {daftar.map((f, n) => (
                <div key={f.id} className="fprog-sel">
                  <button type="button" className="fprog-img" title={`${namaTahap(f) || "Umum"} · ${tglJkt(f.created_at)}`}
                    aria-label={`Perbesar foto ${n + 1} dari ${daftar.length}, ${namaTahap(f) || "umum"}`} onClick={() => setBesar(n)}>
                    <img src={f.url} alt="" loading="lazy" />
                    <span>{namaTahap(f) || "Umum"}</span>
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
          )}
          {!lihat && (
            <div className="fprog-form">
              <div className="fl" style={{ margin: 0 }}>Tambah foto</div>
              <div className="fprog-pilih">
                <button type="button" className="act" disabled={aksi.sibuk || sisa <= files.length} onClick={() => input.current?.click()}>
                  + Pilih foto
                </button>
                <input ref={input} type="file" accept="image/*" multiple hidden onChange={pilihFile} />
                <select className="inp" value={pilih} onChange={(e) => setPilih(e.target.value)} aria-label="Tahap pekerjaan foto ini">
                  <option value="">Umum (tanpa tahap)</option>
                  {tahap.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}
                </select>
              </div>
              {files.length > 0 && (
                <div className="fprog-pv">
                  {pratinjau.map((u, n) => (
                    <span key={u}>
                      <img src={u} alt="" />
                      <button type="button" aria-label="Buang foto ini" onClick={() => setFiles(files.filter((_, k) => k !== n))}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <button type="button" className="btn" disabled={aksi.sibuk || !files.length} onClick={unggah}>
                {files.length ? `Unggah ${files.length} foto` : "Unggah"}
              </button>
              <p className="small" style={{ margin: 0 }}>Maks. {MAKS_PER_UNGGAH} foto sekali unggah, {MAKS_FOTO} per item (sudah {foto.length}).</p>
            </div>
          )}
        </div>
      </div>
      {besar != null && (
        <Pratinjau nama={item.nama} foto={daftar.map((f) => f.url)} cap={daftar.map((f) => `${namaTahap(f) || "Umum"} · ${tglJkt(f.created_at)}`)}
          mulai={besar} tutup={tutupBesar} />
      )}
    </div>,
    document.body
  );
}
