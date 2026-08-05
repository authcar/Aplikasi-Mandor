"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";
import FotoLightbox from "@/components/FotoLightbox";
import KameraModal from "@/components/KameraModal";
import VideoRecorderModal from "@/components/VideoRecorderModal";
import { perbaikiDurasiVideo } from "@/lib/video";

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
  const [video, setVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [kameraOpen, setKameraOpen] = useState(false);
  const [videoRecorderOpen, setVideoRecorderOpen] = useState(false);
  const [mediaChooserOpen, setMediaChooserOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Card riwayat per proyek tertutup default (ringkas, cuma badge jumlah) —
  // tap buat buka & lihat daftar itemnya, sama pola dengan Daftar Perbaikan
  // Supervisor/Master.
  const [openRiwayat, setOpenRiwayat] = useState(() => new Set());
  const toggleRiwayat = (id) =>
    setOpenRiwayat((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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
    setVideo(null);
    setVideoPreview(null);
    setMediaChooserOpen(false);
    setErr("");
  };

  const batalUpload = () => {
    setUploadFor(null);
    setFoto(null);
    setPreview(null);
    setVideo(null);
    setVideoPreview(null);
    setMediaChooserOpen(false);
    setErr("");
  };

  const hapusBukti = () => {
    setFoto(null);
    setPreview(null);
    setVideo(null);
    setVideoPreview(null);
  };

  // Foto & video bukti 1 slot (saling gantiin) — biar tombolnya tetap
  // ringkas (Kamera + Galeri), sama pola dengan PerbaikanForm Supervisor.
  const pilihMediaBukti = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("video/")) {
      setVideo(file);
      setVideoPreview(url);
      setFoto(null);
      setPreview(null);
    } else {
      setFoto(file);
      setPreview(url);
      setVideo(null);
      setVideoPreview(null);
    }
  };

  const pakaiFoto = (file) => {
    setFoto(file);
    setPreview(URL.createObjectURL(file));
    setVideo(null);
    setVideoPreview(null);
    setKameraOpen(false);
  };

  const pakaiVideo = (file) => {
    setVideo(file);
    setVideoPreview(URL.createObjectURL(file));
    setFoto(null);
    setPreview(null);
    setVideoRecorderOpen(false);
  };

  const kirimBukti = async (id) => {
    if (!foto && !video) return setErr("Bukti pengerjaan (foto/video) wajib dilampirkan.");
    const item = list.find((x) => x.id === id);
    setBusy(true);
    setErr("");
    try {
      let foto_bukti_url = null;
      let fotoBuktiSignedUrl = null;
      if (foto) {
        const ext = foto.name.split(".").pop();
        const path = `${item.proyek_id}/bukti-${id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("perbaikan").upload(path, foto);
        if (upErr) throw new Error("Gagal unggah foto: " + upErr.message);
        foto_bukti_url = path;
        const { data: signed } = await supabase.storage.from("perbaikan").createSignedUrl(path, 3600);
        fotoBuktiSignedUrl = signed?.signedUrl || null;
      }

      let video_bukti_url = null;
      let videoBuktiSignedUrl = null;
      if (video) {
        const ext = video.name.split(".").pop();
        const path = `${item.proyek_id}/video-bukti-${id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("perbaikan").upload(path, video);
        if (upErr) throw new Error("Gagal unggah video: " + upErr.message);
        video_bukti_url = path;
        const { data: signed } = await supabase.storage.from("perbaikan").createSignedUrl(path, 3600);
        videoBuktiSignedUrl = signed?.signedUrl || null;
      }

      const { error } = await supabase
        .from("checklist_perbaikan")
        .update({
          status: "PENDING_REVIEW",
          foto_bukti_url,
          video_bukti_url,
          dibaca_supervisor: false,
          catatan_tolak: null,
        })
        .eq("id", id);
      if (error) throw new Error("Gagal mengirim: " + error.message);

      setList((l) =>
        l.map((x) =>
          x.id === id
            ? {
                ...x,
                status: "PENDING_REVIEW",
                fotoBukti: fotoBuktiSignedUrl,
                videoBukti: videoBuktiSignedUrl,
                catatan_tolak: null,
              }
            : x
        )
      );

      fetch("/api/perbaikan/notify-bukti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyek_id: item.proyek_id, uraian: item.uraian }),
      }).catch(() => {});

      // Sync bukti ke Google Drive SENGAJA tidak dipicu di sini — baru
      // dipicu saat Supervisor menyetujui (lihat setujuiBukti di
      // PerbaikanForm.jsx). Kalau dipicu langsung saat kirim, tiap bukti
      // yang ditolak-lalu-dikirim-ulang bakal numpuk di Drive sebagai file
      // yang sudah tidak relevan — cuma versi final yang disetujui yang
      // seharusnya masuk arsip.

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

      {videoRecorderOpen && (
        <VideoRecorderModal
          title="Rekam Video Bukti Pengerjaan"
          onCapture={pakaiVideo}
          onClose={() => setVideoRecorderOpen(false)}
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
                    {(it.foto || it.fotoBukti || it.video || it.videoBukti) && (
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
                        {it.videoBukti && (
                          <FotoLightbox src={it.videoBukti} caption={`Bukti — ${it.uraian}`} type="video">
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
                      <p className="text-xs font-semibold text-gray-600">Lampirkan bukti pekerjaan sudah selesai</p>
                      {preview ? (
                        <div className="relative">
                          <img src={preview} alt="preview bukti" className="w-full max-h-52 rounded-xl border border-gray-200 object-cover" />
                          <button
                            type="button"
                            onClick={hapusBukti}
                            className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
                          >
                            <Icon name="x-circle" className="h-4 w-4" />
                          </button>
                        </div>
                      ) : videoPreview ? (
                        <div className="relative">
                          <video
                            src={videoPreview}
                            controls
                            playsInline
                            onLoadedMetadata={perbaikiDurasiVideo}
                            className="w-full max-h-52 rounded-xl border border-gray-200 bg-black object-contain"
                          />
                          <button
                            type="button"
                            onClick={hapusBukti}
                            className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
                          >
                            <Icon name="x-circle" className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <button
                              type="button"
                              onClick={() => setMediaChooserOpen((o) => !o)}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-500 active:bg-gray-50"
                            >
                              <Icon name="camera" className="h-5 w-5 text-gray-400" />
                              Kamera
                            </button>
                            {mediaChooserOpen && (
                              <div className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                <button
                                  type="button"
                                  onClick={() => { setKameraOpen(true); setMediaChooserOpen(false); }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 active:bg-gray-50"
                                >
                                  <Icon name="camera" className="h-4 w-4" />
                                  Foto
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setVideoRecorderOpen(true); setMediaChooserOpen(false); }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 active:bg-gray-50"
                                >
                                  <Icon name="video" className="h-4 w-4" />
                                  Video
                                </button>
                              </div>
                            )}
                          </div>
                          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-500 active:bg-gray-50">
                            <Icon name="clipboard" className="h-5 w-5 text-gray-400" />
                            Galeri
                            <input type="file" accept="image/*,video/*" className="hidden" onChange={pilihMediaBukti} />
                          </label>
                        </div>
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
            {riwayatGroups.map((g) => {
              const selesai = g.items.filter((it) => it.status === "DONE").length;
              const dibatalkan = g.items.filter((it) => it.status === "CANCELLED").length;
              const terbuka = !!q.trim() || openRiwayat.has(g.proyek_id);
              return (
                <div key={g.proyek_id} className="card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleRiwayat(g.proyek_id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 active:bg-gray-50"
                  >
                    <span className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                        <span className="truncate text-sm font-bold text-gray-700">{g.proyek}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1">
                        {selesai > 0 && (
                          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                            {selesai} selesai
                          </span>
                        )}
                        {dibatalkan > 0 && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                            {dibatalkan} dibatalkan
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-gray-400">
                      <span className="text-[11px]">{g.items.length}</span>
                      <Icon name="chevron-down" className={`h-3.5 w-3.5 transition-transform ${terbuka ? "rotate-180" : ""}`} />
                    </span>
                  </button>

                  {terbuka && (
                    <div className="divide-y divide-gray-100 border-t border-gray-100 px-3">
                      {g.items.map((it) => {
                        const st = STATUS_LABEL[it.status] || STATUS_LABEL.DONE;
                        return (
                          <div key={it.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                            {(it.foto || it.fotoBukti || it.video || it.videoBukti) && (
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
                                {it.videoBukti && (
                                  <FotoLightbox src={it.videoBukti} caption={`Bukti — ${it.uraian}`} type="video">
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
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
