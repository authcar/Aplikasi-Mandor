"use client";
import { useMemo, useState } from "react";
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
  CANCELLED: { label: "Tidak Disetujui", cls: "text-red-500" },
};

// Alur: Mandor menandai selesai DENGAN foto bukti pengerjaan -> status jadi
// PENDING_REVIEW -> Supervisor menyetujui (DONE) atau menolak (balik ke OPEN,
// lihat app/supervisor/perbaikan/PerbaikanForm.jsx).

// Kelompokkan item per proyek (urutan kemunculan pertama) supaya semua
// checklist milik 1 proyek tampil dalam 1 card yang ringkas, bukan 1 card
// per item.
function kelompokPerProyek(items) {
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.proyek_id)) map.set(it.proyek_id, { proyek_id: it.proyek_id, proyek: it.proyek, items: [] });
    map.get(it.proyek_id).items.push(it);
  }
  return [...map.values()];
}

export default function PerbaikanMandorList({ items = [] }) {
  const router = useRouter();
  const supabase = createClient();
  const [list, setList] = useState(items);
  const [proyekFilter, setProyekFilter] = useState("");
  const [q, setQ] = useState("");
  const [uploadFor, setUploadFor] = useState(null);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [kameraOpen, setKameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Dropdown "per proyek" dibuat dari data yang benar-benar ada (bukan
  // daftar proyek resmi) — supaya proyek tanpa item perbaikan gak muncul
  // sebagai pilihan kosong, dan proyek hasil assign manual tetap kebawa.
  const proyekOptions = useMemo(() => {
    const seen = new Map();
    for (const it of list) {
      if (!seen.has(it.proyek_id)) seen.set(it.proyek_id, it.proyek);
    }
    return [...seen.entries()].map(([id, nama]) => ({ id, nama }));
  }, [list]);

  const listTerfilter = list
    .filter((it) => !proyekFilter || it.proyek_id === proyekFilter)
    .filter((it) => !q.trim() || it.uraian.toLowerCase().includes(q.trim().toLowerCase()));

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
    const item = list.find((x) => x.id === id);
    setBusy(true);
    setErr("");
    try {
      const ext = foto.name.split(".").pop();
      const path = `${item.proyek_id}/bukti-${id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("perbaikan").upload(path, foto);
      if (upErr) throw new Error("Gagal unggah foto: " + upErr.message);

      const { data: signed } = await supabase.storage.from("perbaikan").createSignedUrl(path, 3600);

      const { error } = await supabase
        .from("checklist_perbaikan")
        .update({ status: "PENDING_REVIEW", foto_bukti_url: path, dibaca_supervisor: false, catatan_tolak: null })
        .eq("id", id);
      if (error) throw new Error("Gagal mengirim: " + error.message);

      setList((l) =>
        l.map((x) =>
          x.id === id
            ? { ...x, status: "PENDING_REVIEW", fotoBukti: signed?.signedUrl || null, catatan_tolak: null }
            : x
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

  // Selesai/Tidak Disetujui pindah ke section "Riwayat Perbaikan" di bawah
  // supaya daftar utama cuma berisi yang masih perlu ditindaklanjuti.
  const aktif = listTerfilter.filter((it) => it.status !== "DONE" && it.status !== "CANCELLED");
  const riwayat = listTerfilter.filter((it) => it.status === "DONE" || it.status === "CANCELLED");
  const aktifGroups = kelompokPerProyek(aktif);
  const riwayatGroups = kelompokPerProyek(riwayat);
  const tampilkanNamaProyek = proyekOptions.length > 1;

  return (
    <div className="space-y-3">
      {kameraOpen && (
        <KameraModal
          title="Foto Bukti Pengerjaan"
          onCapture={pakaiFoto}
          onClose={() => setKameraOpen(false)}
        />
      )}

      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari checklist perbaikan..."
          className="input !py-2.5 !pl-10 !text-sm"
        />
      </div>

      {proyekOptions.length > 1 && (
        <select
          value={proyekFilter}
          onChange={(e) => setProyekFilter(e.target.value)}
          className="input text-base"
        >
          <option value="">Semua Proyek</option>
          {proyekOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.nama}</option>
          ))}
        </select>
      )}

      {aktif.length === 0 && riwayat.length === 0 && (
        <div className="card flex flex-col items-center gap-2 border-gray-200 bg-gray-50 p-6 text-center text-gray-500">
          <Icon name="search" className="h-8 w-8" />
          <p className="text-sm font-semibold">Tidak ada checklist yang cocok.</p>
        </div>
      )}
      {aktif.length === 0 && riwayat.length > 0 && (
        <div className="card flex flex-col items-center gap-2 border-green-200 bg-green-50 p-6 text-center text-green-700">
          <Icon name="check-circle" className="h-8 w-8" />
          <p className="text-sm font-semibold">Tidak ada perbaikan yang perlu dikerjakan.</p>
        </div>
      )}
      {aktifGroups.map((g) => (
        <div key={g.proyek_id} className="card p-2.5">
          {tampilkanNamaProyek && (
            <p className="mb-1.5 truncate px-0.5 text-xs font-bold uppercase tracking-wide text-gray-400">{g.proyek}</p>
          )}
          <div className="divide-y divide-gray-100">
            {g.items.map((it) => {
              const st = STATUS_LABEL[it.status] || STATUS_LABEL.OPEN;
              const bisaKerjakan = it.status !== "DONE" && it.status !== "CANCELLED" && it.status !== "PENDING_REVIEW";
              return (
                <div key={it.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2.5">
                    {(it.foto || it.fotoBukti || it.video) && (
                      <div className="flex shrink-0 -space-x-2">
                        {it.foto && (
                          <FotoLightbox src={it.foto} caption={it.uraian}>
                            <img src={it.foto} alt="dokumentasi temuan" className="h-10 w-10 rounded-lg border-2 border-white object-cover ring-1 ring-gray-200" />
                          </FotoLightbox>
                        )}
                        {it.fotoBukti && (
                          <FotoLightbox src={it.fotoBukti} caption={`Bukti — ${it.uraian}`}>
                            <img src={it.fotoBukti} alt="bukti pengerjaan" className="h-10 w-10 rounded-lg border-2 border-white object-cover ring-1 ring-gray-200" />
                          </FotoLightbox>
                        )}
                        {it.video && (
                          <FotoLightbox src={it.video} caption={it.uraian} type="video">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white bg-gray-800 text-white ring-1 ring-gray-200">
                              <Icon name="play" className="h-4 w-4" />
                            </span>
                          </FotoLightbox>
                        )}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold leading-snug">{it.uraian}</p>
                        {!it.dibaca_mandor && (
                          <span className="badge shrink-0 bg-red-100 text-red-600">Baru</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        <span className={`font-semibold ${st.cls}`}>{st.label}</span> · {tglID(it.created_at)}
                      </p>
                    </div>
                    {bisaKerjakan && uploadFor !== it.id && (
                      <button onClick={() => mulaiUpload(it.id)} className="btn-success shrink-0 !px-3 !py-1.5 !text-xs">
                        Tandai Selesai
                      </button>
                    )}
                  </div>

                  {it.status === "OPEN" && it.catatan_tolak && (
                    <div className="mt-2 rounded-lg bg-red-50 px-3 py-2">
                      <p className="text-xs font-bold text-red-700">Ditolak Supervisor</p>
                      <p className="text-sm text-red-600">{it.catatan_tolak}</p>
                    </div>
                  )}

                  {uploadFor === it.id && (
                    <div className="mt-2.5 space-y-2 border-t border-gray-100 pt-2.5">
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
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {riwayat.length > 0 && (
        <section className="pt-1">
          <h2 className="mb-2 text-sm font-bold text-gray-500">Riwayat Perbaikan</h2>
          <div className="space-y-2">
            {riwayatGroups.map((g) => (
              <div key={g.proyek_id} className="card p-2.5">
                {tampilkanNamaProyek && (
                  <p className="mb-1.5 truncate px-0.5 text-xs font-bold uppercase tracking-wide text-gray-400">{g.proyek}</p>
                )}
                <div className="divide-y divide-gray-100">
                  {g.items.map((it) => {
                    const st = STATUS_LABEL[it.status] || STATUS_LABEL.DONE;
                    return (
                      <div key={it.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                        {(it.foto || it.fotoBukti || it.video) && (
                          <div className="flex shrink-0 -space-x-2">
                            {it.foto && (
                              <FotoLightbox src={it.foto} caption={it.uraian}>
                                <img src={it.foto} alt="dokumentasi temuan" className="h-10 w-10 rounded-lg border-2 border-white object-cover ring-1 ring-gray-200" />
                              </FotoLightbox>
                            )}
                            {it.fotoBukti && (
                              <FotoLightbox src={it.fotoBukti} caption={`Bukti — ${it.uraian}`}>
                                <img src={it.fotoBukti} alt="bukti pengerjaan" className="h-10 w-10 rounded-lg border-2 border-white object-cover ring-1 ring-gray-200" />
                              </FotoLightbox>
                            )}
                            {it.video && (
                              <FotoLightbox src={it.video} caption={it.uraian} type="video">
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-white bg-gray-800 text-white ring-1 ring-gray-200">
                                  <Icon name="play" className="h-4 w-4" />
                                </span>
                              </FotoLightbox>
                            )}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-snug">{it.uraian}</p>
                          <p className="text-[11px] text-gray-400">
                            <span className={`font-semibold ${st.cls}`}>{st.label}</span> · {tglID(it.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
