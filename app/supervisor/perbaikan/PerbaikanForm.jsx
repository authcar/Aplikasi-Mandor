"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { tglID } from "@/lib/format";
import Icon from "@/components/Icon";
import KameraModal from "@/components/KameraModal";
import FotoLightbox from "@/components/FotoLightbox";

const STATUS_LABEL = {
  OPEN: { label: "Belum Dikerjakan", cls: "text-gray-400" },
  IN_PROGRESS: { label: "Diproses", cls: "text-amber-500" },
  PENDING_REVIEW: { label: "Menunggu Persetujuan Anda", cls: "text-amber-500" },
  DONE: { label: "Selesai", cls: "text-green-500" },
  CANCELLED: { label: "Tidak Disetujui", cls: "text-red-500" },
};

const FILTER_TABS = [
  { key: "SEMUA", label: "Semua" },
  { key: "PENDING_REVIEW", label: "Menunggu Persetujuan" },
];

// Kelompokkan list flat -> per proyek, urutan proyek mengikuti kemunculan
// pertama di `list` (list sudah terurut proyek_id dari query server).
function kelompokkanProyek(list) {
  const grup = [];
  const idx = new Map();
  for (const it of list) {
    if (!idx.has(it.proyek_id)) {
      idx.set(it.proyek_id, grup.length);
      grup.push({ proyekId: it.proyek_id, nama: it.proyek, items: [] });
    }
    grup[idx.get(it.proyek_id)].items.push(it);
  }
  return grup;
}

export default function PerbaikanForm({ proyeks = [], items = [], sudahLaporIds = [] }) {
  const router = useRouter();
  const supabase = createClient();
  const sudahLapor = new Set(sudahLaporIds);

  const [proyekId, setProyekId] = useState(proyeks[0]?.id || "");
  const rowId = useRef(1);
  const kosong = () => ({ id: rowId.current++, uraian: "", foto: null, preview: null, video: null, videoPreview: null });
  const [rows, setRows] = useState(() => [kosong()]);
  const [kameraForRowId, setKameraForRowId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState(items);
  const [tolakFor, setTolakFor] = useState(null);
  const [alasanTolak, setAlasanTolak] = useState("");
  const [errTolak, setErrTolak] = useState("");
  const [cari, setCari] = useState("");
  const [filterStatus, setFilterStatus] = useState("SEMUA");
  // Proyek yang punya item PENDING_REVIEW terbuka duluan (butuh aksi
  // Supervisor); sisanya tertutup supaya "klasifikasi" per proyek terlihat
  // ringkas lewat badge jumlah, bukan langsung daftar penuh.
  const [openProyek, setOpenProyek] = useState(
    () =>
      new Set(
        kelompokkanProyek(items)
          .filter((g) => g.items.some((it) => it.status === "PENDING_REVIEW"))
          .map((g) => g.proyekId)
      )
  );
  const toggleProyek = (id) =>
    setOpenProyek((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const isiTerisi = rows.filter((r) => r.uraian.trim()).length;

  const totalMenunggu = list.filter((it) => it.status === "PENDING_REVIEW").length;

  // Pencarian & filter status jalan lintas-proyek — supaya makin banyak
  // proyek/item, Supervisor tetap bisa langsung nemu yang dicari tanpa buka
  // grup satu-satu. Saat aktif nyari/nyaring, grup yang cocok otomatis
  // kebuka (lihat `terbuka` di render) dan grup yang gak cocok disembunyikan.
  const sedangFilter = cari.trim() !== "" || filterStatus !== "SEMUA";
  const norm = (s) => (s || "").toLowerCase();
  const grupTampil = kelompokkanProyek(list)
    .map((g) => {
      const needle = norm(cari);
      const itemsTampil = g.items.filter((it) => {
        if (filterStatus !== "SEMUA" && it.status !== filterStatus) return false;
        if (!needle) return true;
        return norm(it.uraian).includes(needle) || norm(g.nama).includes(needle);
      });
      return { ...g, itemsTampil };
    })
    .filter((g) => !sedangFilter || g.itemsTampil.length > 0)
    // Proyek dengan item menunggu persetujuan naik ke atas — biar gak
    // ketiban scroll pas daftar proyeknya udah panjang.
    .sort((a, b) => {
      const pendingA = a.items.filter((it) => it.status === "PENDING_REVIEW").length;
      const pendingB = b.items.filter((it) => it.status === "PENDING_REVIEW").length;
      return pendingB - pendingA;
    });

  const tambahRow = () => setRows((r) => [...r, kosong()]);
  const hapusRow = (id) => setRows((r) => r.filter((row) => row.id !== id));
  const ubahUraian = (id, value) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, uraian: value } : row)));
  const hapusFotoRow = (id) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, foto: null, preview: null } : row)));

  const pilihFotoRow = (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRows((r) => r.map((row) => (row.id === id ? { ...row, foto: file, preview: URL.createObjectURL(file) } : row)));
  };

  const pakaiFotoRow = (file) => {
    setRows((r) =>
      r.map((row) => (row.id === kameraForRowId ? { ...row, foto: file, preview: URL.createObjectURL(file) } : row))
    );
    setKameraForRowId(null);
  };

  const hapusVideoRow = (id) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, video: null, videoPreview: null } : row)));

  const pilihVideoRow = (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRows((r) => r.map((row) => (row.id === id ? { ...row, video: file, videoPreview: URL.createObjectURL(file) } : row)));
  };

  // Simpan semua baris uraian sekaligus dalam satu proyek/periode — supaya
  // Supervisor gak perlu pilih ulang proyek per temuan (lihat diskusi UX di
  // percakapan ini). Upload foto dulu satu-satu, baru insert semua baris
  // checklist dalam satu panggilan supaya nomor urut (`no`) konsisten.
  const submit = async (e) => {
    e.preventDefault();
    const terisi = rows.filter((r) => r.uraian.trim());
    if (!proyekId || terisi.length === 0) return;
    setBusy(true);
    const uid = (await supabase.auth.getUser()).data.user.id;
    const noBase = list.filter((i) => i.proyek_id === proyekId).length;

    const inserts = [];
    for (let i = 0; i < terisi.length; i++) {
      const row = terisi[i];
      let foto_url = null;
      if (row.foto) {
        const ext = row.foto.name.split(".").pop();
        const path = `${proyekId}/${Date.now()}-${i}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("perbaikan").upload(path, row.foto);
        if (uploadError) {
          setBusy(false);
          alert(`Gagal unggah foto item #${i + 1}: ${uploadError.message}`);
          return;
        }
        foto_url = path;
      }
      let video_url = null;
      if (row.video) {
        const ext = row.video.name.split(".").pop();
        const path = `${proyekId}/video-${Date.now()}-${i}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("perbaikan").upload(path, row.video);
        if (uploadError) {
          setBusy(false);
          alert(`Gagal unggah video item #${i + 1}: ${uploadError.message}`);
          return;
        }
        video_url = path;
      }
      inserts.push({
        proyek_id: proyekId,
        no: noBase + i + 1,
        uraian: row.uraian.trim(),
        foto_url,
        video_url,
        created_by: uid,
      });
    }

    const { error } = await supabase.from("checklist_perbaikan").insert(inserts);
    setBusy(false);
    if (error) {
      alert(`Gagal menyimpan: ${error.message}`);
      return;
    }
    router.refresh();
    setRows([kosong()]);
  };

  // Setujui bukti pengerjaan yang dikirim Mandor (status PENDING_REVIEW).
  // dibaca_mandor direset ke false supaya Mandor melihat badge "Baru" —
  // hasil review ini muncul lagi di checklist-nya.
  const setujuiBukti = async (id) => {
    setList((l) => l.map((x) => (x.id === id ? { ...x, status: "DONE" } : x)));
    await supabase
      .from("checklist_perbaikan")
      .update({ status: "DONE", selesai_at: new Date().toISOString(), dibaca_mandor: false })
      .eq("id", id);
    router.refresh();
  };

  const mulaiTolak = (id) => {
    setTolakFor(id);
    setAlasanTolak("");
    setErrTolak("");
  };

  const batalTolak = () => {
    setTolakFor(null);
    setAlasanTolak("");
    setErrTolak("");
  };

  // Tolak bukti pengerjaan — wajib isi alasan supaya Mandor tahu apa yang
  // perlu diperbaiki, bukan cuma disuruh ulang tanpa konteks.
  const kirimTolak = async (id) => {
    if (!alasanTolak.trim()) return setErrTolak("Alasan penolakan wajib diisi.");
    setBusy(true);
    setList((l) => l.map((x) => (x.id === id ? { ...x, status: "OPEN" } : x)));
    await supabase
      .from("checklist_perbaikan")
      .update({
        status: "OPEN",
        selesai_at: null,
        dibaca_mandor: false,
        catatan_tolak: alasanTolak.trim(),
      })
      .eq("id", id);
    setBusy(false);
    batalTolak();
    router.refresh();
  };

  // Ikon X pojok kanan card — batalkan item sepenuhnya (bukan minta Mandor
  // mengulang). Statusnya jadi CANCELLED (bukan dihapus dari database, tetap
  // muncul di riwayat Master) tapi langsung hilang dari daftar aktif ini.
  const batalkanItem = async (id) => {
    if (!confirm("Batalkan item perbaikan ini? Akan hilang dari daftar, tapi tetap tercatat di riwayat Master."))
      return;
    setList((l) => l.filter((x) => x.id !== id));
    await supabase
      .from("checklist_perbaikan")
      .update({ status: "CANCELLED", selesai_at: null, dibaca_mandor: false })
      .eq("id", id);
    router.refresh();
  };

  if (proyeks.length === 0)
    return <p className="p-6 text-gray-500">Belum ada proyek aktif.</p>;

  return (
    <div className="space-y-6">
      {kameraForRowId && (
        <KameraModal
          title="Foto Dokumentasi"
          onCapture={pakaiFotoRow}
          onClose={() => setKameraForRowId(null)}
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
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <div key={row.id} className="rounded-xl border border-gray-200 p-2.5">
                  <div className="flex items-start gap-2">
                    <textarea
                      value={row.uraian}
                      onChange={(e) => ubahUraian(row.id, e.target.value)}
                      placeholder={
                        idx === 0
                          ? "Contoh: Ganti lampu outbow area kanopi balkon lt3..."
                          : `Uraian item #${idx + 1}...`
                      }
                      rows={2}
                      className="input flex-1 !text-sm resize-none"
                    />
                    {row.preview ? (
                      <div className="relative shrink-0">
                        <img
                          src={row.preview}
                          alt="preview"
                          className="h-14 w-14 rounded-lg border border-gray-200 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => hapusFotoRow(row.id)}
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-black/60 p-0.5 text-white"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => setKameraForRowId(row.id)}
                          title="Kamera"
                          className="flex h-14 w-9 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 active:bg-gray-50"
                        >
                          <Icon name="camera" className="h-4 w-4" />
                        </button>
                        <label
                          title="Galeri"
                          className="flex h-14 w-9 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 active:bg-gray-50"
                        >
                          <Icon name="clipboard" className="h-4 w-4" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => pilihFotoRow(row.id, e)}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {row.videoPreview ? (
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                      <Icon name="video" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="min-w-0 flex-1 truncate text-xs text-gray-600">{row.video.name}</span>
                      <button
                        type="button"
                        onClick={() => hapusVideoRow(row.id)}
                        className="shrink-0 text-gray-400 active:text-red-500"
                      >
                        <Icon name="x-circle" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 py-1.5 text-xs font-medium text-gray-400 active:bg-gray-50">
                      <Icon name="video" className="h-3.5 w-3.5" />
                      Tambah Video (opsional)
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => pilihVideoRow(row.id, e)}
                      />
                    </label>
                  )}

                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => hapusRow(row.id)}
                      className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-gray-400 active:text-red-500"
                    >
                      <Icon name="x-circle" className="h-3.5 w-3.5" />
                      Hapus item ini
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={tambahRow}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 active:bg-gray-50"
            >
              <Icon name="plus" className="h-4 w-4" />
              Tambah Uraian Lain
            </button>
          </div>

          <button disabled={busy || isiTerisi === 0} className="btn-primary btn-lg w-full">
            {busy ? "Menyimpan..." : isiTerisi > 1 ? `Laporkan Semua (${isiTerisi} Temuan)` : "Laporkan Temuan"}
          </button>
        </form>
      </div>

      {/* Daftar item, dikelompokkan per proyek */}
      <section>
        <h2 className="mb-3 font-bold text-gray-700">Daftar Perbaikan</h2>
        {list.length === 0 ? (
          <div className="card flex flex-col items-center gap-2 border-green-200 bg-green-50 p-8 text-center text-green-700">
            <Icon name="check-circle" className="h-9 w-9" />
            <p className="font-semibold">Belum ada item perbaikan.</p>
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari uraian atau proyek..."
                className="input !py-2.5 !pl-10 !text-sm"
              />
            </div>

            <div className="flex gap-1 border-b border-gray-200 mb-3">
              {FILTER_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilterStatus(t.key)}
                  className={`relative px-3 py-2 text-sm font-semibold transition-colors ${
                    filterStatus === t.key ? "text-brand" : "text-gray-400"
                  }`}
                >
                  {t.label}
                  {t.key === "PENDING_REVIEW" && totalMenunggu > 0 && (
                    <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] text-white">{totalMenunggu}</span>
                  )}
                  {filterStatus === t.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand" />
                  )}
                </button>
              ))}
            </div>

            {grupTampil.length === 0 ? (
              <div className="card flex flex-col items-center gap-2 border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
                <Icon name="check-circle" className="h-9 w-9" />
                <p className="font-semibold">Tidak ada yang cocok.</p>
              </div>
            ) : (
          <div className="space-y-2">
            {grupTampil.map((g) => {
              const belum = g.items.filter((it) => it.status === "OPEN" || it.status === "IN_PROGRESS").length;
              const menunggu = g.items.filter((it) => it.status === "PENDING_REVIEW").length;
              const selesai = g.items.filter((it) => it.status === "DONE").length;
              const terbuka = sedangFilter || openProyek.has(g.proyekId);
              return (
                <div key={g.proyekId} className="card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleProyek(g.proyekId)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 active:bg-gray-50"
                  >
                    <span className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${sudahLapor.has(g.proyekId) ? "bg-green-500" : "bg-gray-300"}`}
                          title={sudahLapor.has(g.proyekId) ? "Sudah lapor hari ini" : "Belum lapor hari ini"}
                        />
                        <span className="truncate text-sm font-bold text-gray-700">{g.nama}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1">
                        {menunggu > 0 && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            {menunggu} menunggu
                          </span>
                        )}
                        {belum > 0 && (
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                            {belum} belum
                          </span>
                        )}
                        {selesai > 0 && (
                          <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                            {selesai} selesai
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
                    <div className="space-y-1.5 border-t border-gray-100 bg-gray-50/60 p-1.5">
                      {g.itemsTampil.map((it) => {
                        const st = STATUS_LABEL[it.status] || STATUS_LABEL.OPEN;
                        const sedangTolak = tolakFor === it.id;
                        return (
                          <div key={it.id} className="rounded-lg bg-white p-2 shadow-sm">
                            <div className="flex items-start gap-2">
                              {(it.foto || it.fotoBukti || it.video) && (
                                <div className="flex shrink-0 -space-x-2">
                                  {it.foto && (
                                    <FotoLightbox src={it.foto} caption={it.uraian}>
                                      <img src={it.foto} alt="dokumentasi" className="h-9 w-9 rounded-md border-2 border-white object-cover ring-1 ring-gray-200" />
                                    </FotoLightbox>
                                  )}
                                  {it.fotoBukti && (
                                    <FotoLightbox src={it.fotoBukti} caption={`Bukti — ${it.uraian}`}>
                                      <img src={it.fotoBukti} alt="bukti pengerjaan" className="h-9 w-9 rounded-md border-2 border-white object-cover ring-1 ring-gray-200" />
                                    </FotoLightbox>
                                  )}
                                  {it.video && (
                                    <FotoLightbox src={it.video} caption={it.uraian} type="video">
                                      <span className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-white bg-gray-800 text-white ring-1 ring-gray-200">
                                        <Icon name="play" className="h-3.5 w-3.5" />
                                      </span>
                                    </FotoLightbox>
                                  )}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold leading-snug">{it.uraian}</p>
                                <p className="mt-0.5 truncate text-[10px] text-gray-400">
                                  <span className={`font-semibold ${st.cls}`}>{st.label}</span>
                                  {" "}· {tglID(it.created_at)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => batalkanItem(it.id)}
                                title="Batalkan item ini"
                                className="-mr-0.5 -mt-0.5 shrink-0 p-0.5 text-gray-300 active:text-red-500"
                              >
                                <Icon name="x-circle" className="h-4 w-4" />
                              </button>
                            </div>

                            {it.status === "PENDING_REVIEW" && sedangTolak && (
                              <div className="mt-1.5 space-y-1.5 border-t border-gray-100 pt-1.5">
                                <textarea
                                  value={alasanTolak}
                                  onChange={(e) => setAlasanTolak(e.target.value)}
                                  placeholder="Alasan penolakan..."
                                  rows={2}
                                  className="input !py-1.5 !text-sm"
                                  autoFocus
                                />
                                {errTolak && <p className="text-xs font-medium text-red-600">{errTolak}</p>}
                                <div className="grid grid-cols-2 gap-1.5">
                                  <button type="button" onClick={batalTolak} disabled={busy} className="btn-outline !py-1.5 !text-xs text-gray-500">
                                    Batal
                                  </button>
                                  <button type="button" onClick={() => kirimTolak(it.id)} disabled={busy} className="btn-danger !py-1.5 !text-xs">
                                    {busy ? "Mengirim..." : "Kirim"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {it.status === "PENDING_REVIEW" && !sedangTolak && (
                              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                                <button onClick={() => mulaiTolak(it.id)} className="btn-outline !py-1.5 !text-xs text-red-500">
                                  Tidak Disetujui
                                </button>
                                <button onClick={() => setujuiBukti(it.id)} className="btn-success !py-1.5 !text-xs">
                                  Disetujui
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
