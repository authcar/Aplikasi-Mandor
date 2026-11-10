"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import KameraModal from "@/components/KameraModal";
import { kompresGambar } from "@/lib/gambar";
import { MAKS_FOTO_KEGIATAN } from "@/lib/laporanFoto";

const STATUS = [
  { value: "ON_PROGRESS", label: "Dikerjakan", aktif: "border-blue-400 bg-blue-50 text-blue-700" },
  { value: "DONE", label: "Selesai", aktif: "border-green-400 bg-green-50 text-green-700" },
  { value: "PERBAIKAN", label: "Perbaikan", aktif: "border-red-400 bg-red-50 text-red-700" },
];

// Form koreksi satu kegiatan laporan harian (deskripsi, status, foto).
// Izin sebenarnya dicek di server (PATCH /api/laporan-harian/[id]) dan RLS;
// komponen ini hanya tampil kalau pemakainya memang berhak.
export default function KoreksiLaporan({ laporan, onSelesai, onBatal }) {
  const [deskripsi, setDeskripsi] = useState(laporan.deskripsi || "");
  const [status, setStatus] = useState(laporan.status || "ON_PROGRESS");
  // Foto baru DITAMBAHKAN ke foto yang sudah ada. Foto lama bisa dibuang satu
  // per satu (path-nya dikumpulkan di `dibuang`, baru benar-benar dihapus saat Simpan).
  const [fotoBaru, setFotoBaru] = useState([]); // [{ key, file, preview }]
  const [dibuang, setDibuang] = useState([]); // path foto lama yang akan dibuang
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [kamera, setKamera] = useState(false);

  const urlLama = laporan.fotoSignedUrls?.length ? laporan.fotoSignedUrls : laporan.fotoSignedUrl ? [laporan.fotoSignedUrl] : [];
  // path sejajar dengan url; kosong (null) = tidak bisa dihapus satuan.
  const semuaLama = urlLama.map((url, n) => ({ url, path: laporan.fotoPaths?.[n] || null }));
  const fotoLama = semuaLama.filter((f) => !f.path || !dibuang.includes(f.path));
  const jumlahLama = fotoLama.length;

  // Lepas URL pratinjau lokal saat form ditutup.
  const refBaru = useRef(fotoBaru);
  refBaru.current = fotoBaru;
  useEffect(() => () => refBaru.current.forEach((f) => URL.revokeObjectURL(f.preview)), []);

  const tambahBaru = (files) =>
    setFotoBaru((cur) => {
      const muat = files.slice(0, Math.max(0, MAKS_FOTO_KEGIATAN - jumlahLama - cur.length));
      return [...cur, ...muat.map((file) => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }))];
    });

  const pilihFoto = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const kecil = [];
    for (const f of files) kecil.push(await kompresGambar(f));
    tambahBaru(kecil);
  };

  const pakaiKamera = (file) => {
    tambahBaru([file]);
    setKamera(false);
  };

  const buangBaru = (key) =>
    setFotoBaru((cur) => {
      cur.filter((f) => f.key === key).forEach((f) => URL.revokeObjectURL(f.preview));
      return cur.filter((f) => f.key !== key);
    });

  const total = jumlahLama + fotoBaru.length;

  const simpan = async () => {
    if (!deskripsi.trim()) {
      setErr("Deskripsi wajib diisi.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("deskripsi", deskripsi.trim());
      fd.append("status", status);
      dibuang.forEach((p) => fd.append("buang_foto", p));
      fotoBaru.forEach((f) => fd.append("foto", f.file));
      const res = await fetch(`/api/laporan-harian/${laporan.id}`, { method: "PATCH", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan perubahan.");
      // Foto lama (kecuali dibuang) + pratinjau lokal foto baru. Pratinjau tidak
      // di-revoke di sini karena masih dipakai riwayat sampai halaman dimuat ulang.
      const urls = [...fotoLama.map((f) => f.url), ...fotoBaru.map((f) => f.preview)];
      refBaru.current = [];
      onSelesai({
        deskripsi: j.data.deskripsi,
        status: j.data.status,
        foto_url: j.data.foto_url,
        foto_urls: j.data.foto_urls,
        fotoPaths: j.data.foto_urls || [],
        fotoSignedUrls: urls,
        fotoSignedUrl: urls[0] || null,
      });
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 overflow-y-auto">
      {kamera && <KameraModal title="Tambah Foto" onCapture={pakaiKamera} onClose={() => setKamera(false)} />}
      <div className="grid grid-cols-3 gap-2">
        {STATUS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={`rounded-xl border-2 py-2 text-xs font-semibold ${
              status === s.value ? s.aktif : "border-gray-200 bg-white text-gray-400"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <textarea
        value={deskripsi}
        onChange={(e) => setDeskripsi(e.target.value)}
        className="input min-h-24 text-base"
        placeholder="Deskripsi kegiatan"
      />

      <div>
        {total > 0 && (
          <div className="mb-2 grid grid-cols-3 gap-2">
            {fotoLama.map((f, n) => (
              <div key={f.url} className="relative">
                <img src={f.url} alt={`foto ${n + 1}`} className="aspect-square w-full rounded-xl border border-gray-200 object-cover" />
                {f.path && (
                  <button
                    type="button"
                    onClick={() => setDibuang((d) => [...d, f.path])}
                    className="absolute right-1 top-1 rounded-full bg-red-600/80 p-1 text-white"
                    title="Hapus foto ini"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            {fotoBaru.map((f) => (
              <div key={f.key} className="relative">
                <img src={f.preview} alt="foto baru" className="aspect-square w-full rounded-xl border-2 border-brand/40 object-cover" />
                <button
                  type="button"
                  onClick={() => buangBaru(f.key)}
                  className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white"
                  title="Batalkan foto ini"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {total < MAKS_FOTO_KEGIATAN && (
            <>
              <button
                type="button"
                onClick={() => setKamera(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 active:bg-gray-50"
              >
                <Icon name="camera" className="h-4 w-4 text-gray-400" />
                Kamera
              </button>
              <label className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 active:bg-gray-50">
                Galeri ({total}/{MAKS_FOTO_KEGIATAN})
                <input type="file" accept="image/*" multiple className="hidden" onChange={pilihFoto} />
              </label>
            </>
          )}
        </div>
        {dibuang.length > 0 && (
          <p className="mt-1.5 text-xs text-red-500">
            {dibuang.length} foto akan dihapus saat Simpan.{" "}
            <button type="button" onClick={() => setDibuang([])} className="font-semibold underline">
              Batalkan
            </button>
          </p>
        )}
      </div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{err}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onBatal} disabled={busy} className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-50">
          Batal
        </button>
        <button type="button" onClick={simpan} disabled={busy} className="btn-primary flex-1 !py-2.5 text-sm disabled:opacity-50">
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}
