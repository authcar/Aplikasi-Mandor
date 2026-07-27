"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";
import FotoLightbox from "@/components/FotoLightbox";
import KameraModal from "@/components/KameraModal";

const STATUS_LABEL = {
  OPEN: { label: "Belum Dikerjakan", cls: "text-gray-400" },
  IN_PROGRESS: { label: "Diproses", cls: "text-amber-500" },
  PENDING_REVIEW: { label: "Menunggu Persetujuan Supervisor", cls: "text-amber-500" },
  DONE: { label: "Selesai", cls: "text-green-500" },
  CANCELLED: { label: "Dibatalkan", cls: "text-red-500" },
};

// Alur: Mandor menandai selesai DENGAN foto bukti pengerjaan -> status jadi
// PENDING_REVIEW -> Supervisor menyetujui (DONE) atau menolak (balik ke OPEN,
// lihat app/supervisor/perbaikan/PerbaikanForm.jsx).
export default function PerbaikanMandorList({ items = [], proyekId }) {
  const router = useRouter();
  const supabase = createClient();
  const [list, setList] = useState(items);
  const [uploadFor, setUploadFor] = useState(null);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [kameraOpen, setKameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const mulaiUpload = (id) => {
    setUploadFor(id);
    setFoto(null);
    setPreview(null);
    setErr("");
  };

  const batalUpload = () => {
    setUploadFor(null);
    setFoto(null);
    setPreview(null);
    setErr("");
  };

  const pilihFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const pakaiFoto = (file) => {
    setFoto(file);
    setPreview(URL.createObjectURL(file));
    setKameraOpen(false);
  };

  const kirimBukti = async (id) => {
    if (!foto) return setErr("Foto bukti pengerjaan wajib dilampirkan.");
    setBusy(true);
    setErr("");
    try {
      const ext = foto.name.split(".").pop();
      const path = `${proyekId}/bukti-${id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("perbaikan").upload(path, foto);
      if (upErr) throw new Error("Gagal unggah foto: " + upErr.message);

      const { data: signed } = await supabase.storage.from("perbaikan").createSignedUrl(path, 3600);

      const { error } = await supabase
        .from("checklist_perbaikan")
        .update({ status: "PENDING_REVIEW", foto_bukti_url: path, dibaca_supervisor: false })
        .eq("id", id);
      if (error) throw new Error("Gagal mengirim: " + error.message);

      setList((l) =>
        l.map((x) =>
          x.id === id ? { ...x, status: "PENDING_REVIEW", fotoBukti: signed?.signedUrl || null } : x
        )
      );
      batalUpload();
      router.refresh();
    } catch (e) {
      setErr(e.message || "Gagal mengirim bukti. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  if (list.length === 0)
    return (
      <div className="card flex flex-col items-center gap-2 border-green-200 bg-green-50 p-8 text-center text-green-700">
        <Icon name="check-circle" className="h-9 w-9" />
        <p className="font-semibold">Belum ada checklist perbaikan.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {kameraOpen && (
        <KameraModal
          title="Foto Bukti Pengerjaan"
          onCapture={pakaiFoto}
          onClose={() => setKameraOpen(false)}
        />
      )}
      {list.map((it) => {
        const st = STATUS_LABEL[it.status] || STATUS_LABEL.OPEN;
        const bisaKerjakan = it.status !== "DONE" && it.status !== "CANCELLED" && it.status !== "PENDING_REVIEW";
        return (
          <div key={it.id} className="card p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-gray-400">No. {it.no}</p>
                {!it.dibaca_mandor && (
                  <span className="badge bg-red-100 text-red-600">Baru</span>
                )}
              </div>
              <p className="shrink-0 text-xs text-gray-400">{tglID(it.created_at)}</p>
            </div>
            <p className="font-semibold">{it.uraian}</p>
            {it.periode && <p className="mt-0.5 text-sm text-gray-500">Periode {it.periode}</p>}
            {it.foto && (
              <FotoLightbox src={it.foto} caption={it.uraian} className="mt-2">
                <img src={it.foto} alt="dokumentasi temuan" className="h-28 w-full rounded-xl border border-gray-200 object-cover" />
              </FotoLightbox>
            )}
            {it.fotoBukti && (
              <div className="mt-2">
                <p className="mb-1 text-xs font-semibold text-gray-500">Foto Bukti Pengerjaan Anda</p>
                <FotoLightbox src={it.fotoBukti} caption={`Bukti — ${it.uraian}`}>
                  <img src={it.fotoBukti} alt="bukti pengerjaan" className="h-28 w-full rounded-xl border border-gray-200 object-cover" />
                </FotoLightbox>
              </div>
            )}

            {uploadFor === it.id ? (
              <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-600">Lampirkan foto bukti pekerjaan sudah selesai</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setKameraOpen(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-500 active:bg-gray-50"
                  >
                    <Icon name="camera" className="h-5 w-5 text-gray-400" />
                    Kamera
                  </button>
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-500 active:bg-gray-50">
                    <Icon name="clipboard" className="h-5 w-5 text-gray-400" />
                    Galeri
                    <input type="file" accept="image/*" className="hidden" onChange={pilihFoto} />
                  </label>
                </div>
                {preview && (
                  <img src={preview} alt="preview bukti" className="w-full max-h-52 rounded-xl border border-gray-200 object-cover" />
                )}
                {err && <p className="text-sm font-medium text-red-600">{err}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={batalUpload} disabled={busy} className="btn-outline text-gray-500">
                    Batal
                  </button>
                  <button type="button" onClick={() => kirimBukti(it.id)} disabled={busy} className="btn-success">
                    {busy ? "Mengirim..." : "Kirim ke Supervisor"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between">
                <span className={`text-xs font-semibold ${st.cls}`}>{st.label}</span>
                {bisaKerjakan && (
                  <button onClick={() => mulaiUpload(it.id)} className="btn-success">
                    Tandai Selesai
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
