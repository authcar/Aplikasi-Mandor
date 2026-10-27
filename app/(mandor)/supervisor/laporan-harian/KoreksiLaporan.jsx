"use client";
import { useEffect, useState } from "react";
import { kompresGambar } from "@/lib/gambar";

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
  const [fotoBaru, setFotoBaru] = useState(null);
  const [previewBaru, setPreviewBaru] = useState(null);
  const [hapusFoto, setHapusFoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => () => previewBaru && URL.revokeObjectURL(previewBaru), [previewBaru]);

  const pilihFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const kecil = await kompresGambar(file);
    setFotoBaru(kecil);
    setPreviewBaru(URL.createObjectURL(kecil));
    setHapusFoto(false);
  };

  const buangFoto = () => {
    setFotoBaru(null);
    setPreviewBaru(null);
    setHapusFoto(true);
  };

  const tampilFoto = previewBaru || (hapusFoto ? null : laporan.fotoSignedUrl);

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
      if (fotoBaru) fd.append("foto", fotoBaru);
      else if (hapusFoto) fd.append("hapus_foto", "1");
      const res = await fetch(`/api/laporan-harian/${laporan.id}`, { method: "PATCH", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Gagal menyimpan perubahan.");
      onSelesai({
        deskripsi: j.data.deskripsi,
        status: j.data.status,
        foto_url: j.data.foto_url,
        // URL pratinjau lokal kalau foto diganti; null kalau dibuang; selain itu tetap yang lama.
        fotoSignedUrl: fotoBaru ? previewBaru : hapusFoto ? null : laporan.fotoSignedUrl,
      });
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 overflow-y-auto">
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
        {tampilFoto && (
          <img src={tampilFoto} alt="foto" className="mb-2 max-h-48 w-full rounded-xl border border-gray-200 object-contain" />
        )}
        <div className="flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 active:bg-gray-50">
            {tampilFoto ? "Ganti foto" : "Tambah foto"}
            <input type="file" accept="image/*" className="hidden" onChange={pilihFoto} />
          </label>
          {tampilFoto && (
            <button
              type="button"
              onClick={buangFoto}
              className="rounded-xl border-2 border-dashed border-red-200 px-4 text-sm font-medium text-red-500 active:bg-red-50"
            >
              Hapus foto
            </button>
          )}
        </div>
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
