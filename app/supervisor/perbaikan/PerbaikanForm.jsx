"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";
import KameraModal from "@/components/KameraModal";
import FotoLightbox from "@/components/FotoLightbox";

const STATUS_LABEL = {
  OPEN: { label: "Belum Dikerjakan", cls: "text-gray-400" },
  IN_PROGRESS: { label: "Diproses", cls: "text-amber-500" },
  DONE: { label: "Selesai", cls: "text-green-500" },
  CANCELLED: { label: "Dibatalkan", cls: "text-red-500" },
};

export default function PerbaikanForm({ proyeks = [], items = [] }) {
  const router = useRouter();
  const supabase = createClient();

  const [proyekId, setProyekId] = useState(proyeks[0]?.id || "");
  const [uraian, setUraian] = useState("");
  const [periode, setPeriode] = useState("1");
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [kameraOpen, setKameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState(items);

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

  const submit = async (e) => {
    e.preventDefault();
    if (!proyekId || !uraian) return;
    setBusy(true);
    const uid = (await supabase.auth.getUser()).data.user.id;
    let foto_url = null;
    if (foto) {
      const ext = foto.name.split(".").pop();
      const path = `${proyekId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("perbaikan").upload(path, foto);
      if (uploadError) {
        setBusy(false);
        alert(`Gagal unggah foto: ${uploadError.message}`);
        return;
      }
      foto_url = path;
    }
    const no = list.filter((i) => i.proyek_id === proyekId).length + 1;
    const { error } = await supabase.from("checklist_perbaikan").insert({
      proyek_id: proyekId,
      no,
      uraian,
      periode,
      foto_url,
      created_by: uid,
    });
    setBusy(false);
    if (error) {
      alert(`Gagal menyimpan: ${error.message}`);
      return;
    }
    router.refresh();
    setUraian("");
    setFoto(null);
    setPreview(null);
  };

  const ubahStatus = async (id, status) => {
    setList((l) => l.map((x) => (x.id === id ? { ...x, status } : x)));
    await supabase
      .from("checklist_perbaikan")
      .update({ status, selesai_at: status === "DONE" ? new Date().toISOString() : null })
      .eq("id", id);
    router.refresh();
  };

  if (proyeks.length === 0)
    return <p className="p-6 text-gray-500">Belum ada proyek aktif.</p>;

  return (
    <div className="space-y-6">
      {kameraOpen && (
        <KameraModal
          title="Foto Dokumentasi"
          onCapture={pakaiFoto}
          onClose={() => setKameraOpen(false)}
        />
      )}

      {/* Form Card */}
      <div className="card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold tracking-tight">Tambah Item Perbaikan</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Proyek</label>
            <select
              value={proyekId}
              onChange={(e) => setProyekId(e.target.value)}
              className="input"
              required
            >
              {proyeks.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} {p.mandor?.name ? `· ${p.mandor.name}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Uraian Pekerjaan Perapihan</label>
            <textarea
              value={uraian}
              onChange={(e) => setUraian(e.target.value)}
              placeholder="Contoh: Ganti lampu outbow area kanopi balkon lt3..."
              rows={3}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">Periode</label>
            <input
              value={periode}
              onChange={(e) => setPeriode(e.target.value)}
              placeholder="1"
              className="input"
            />
          </div>

          <div>
            <label className="label">Dokumentasi (opsional)</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKameraOpen(true)}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 active:bg-gray-50"
              >
                <Icon name="camera" className="h-5 w-5 text-gray-400" />
                Kamera
              </button>
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 active:bg-gray-50">
                <Icon name="clipboard" className="h-5 w-5 text-gray-400" />
                Galeri
                <input type="file" accept="image/*" className="hidden" onChange={pilihFoto} />
              </label>
            </div>
            {preview && (
              <div className="relative mt-2">
                <img src={preview} alt="preview" className="w-full rounded-xl border border-gray-200 object-cover max-h-52" />
                <button
                  type="button"
                  onClick={() => { setFoto(null); setPreview(null); }}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <button disabled={busy} className="btn-primary btn-lg w-full">
            {busy ? "Menyimpan..." : "Tambah ke Checklist"}
          </button>
        </form>
      </div>

      {/* Daftar item */}
      <section>
        <h2 className="mb-3 font-bold text-gray-700">Daftar Perbaikan</h2>
        {list.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 border-green-200 bg-green-50 p-8 text-center text-green-700">
            <Icon name="check-circle" className="h-9 w-9" />
            <p className="font-semibold">Belum ada item perbaikan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((it) => {
              const st = STATUS_LABEL[it.status] || STATUS_LABEL.OPEN;
              return (
                <div key={it.id} className="card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold text-gray-400">
                      No. {it.no} · {it.proyek}
                    </p>
                    <p className="shrink-0 text-xs text-gray-400">{tglID(it.created_at)}</p>
                  </div>
                  <p className="font-semibold">{it.uraian}</p>
                  {it.periode && (
                    <p className="mt-0.5 text-sm text-gray-500">Periode {it.periode}</p>
                  )}
                  {it.foto && (
                    <FotoLightbox src={it.foto} caption={it.uraian} className="mt-2">
                      <img src={it.foto} alt="dokumentasi" className="h-28 w-full rounded-xl border border-gray-200 object-cover" />
                    </FotoLightbox>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    {it.status === "DONE" || it.status === "CANCELLED" ? (
                      <button
                        onClick={() => ubahStatus(it.id, "OPEN")}
                        className="btn-outline text-gray-500"
                      >
                        Buka Lagi
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => ubahStatus(it.id, "CANCELLED")}
                          className="btn-outline text-red-500"
                        >
                          Batalkan
                        </button>
                        <button
                          onClick={() => ubahStatus(it.id, "DONE")}
                          className="btn-success"
                        >
                          Tandai Selesai
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
