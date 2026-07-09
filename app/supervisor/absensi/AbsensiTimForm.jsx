"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import KameraModal from "@/components/KameraModal";
import RiwayatLaporanCard from "@/components/RiwayatLaporanCard";

// Editor absensi harian per tim.
// Tiap baris punya counter jumlah orang (boleh dikosongkan untuk baris
// bernama, mis. "Depi ke TA apartment...") + keterangan kegiatan.
export default function AbsensiTimForm({ initialTims = [], initialFotos = [], today, riwayat = [] }) {
  const router = useRouter();
  const supabase = createClient();

  const [tims, setTims] = useState(
    initialTims.length
      ? initialTims
      : [{ nama: "", lines: [{ jumlah: "", kegiatan: "" }] }]
  );
  const [fotos, setFotos] = useState(initialFotos);
  const [kameraOpen, setKameraOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState("");

  // ---------- dokumentasi ----------
  const unggahFoto = async (file) => {
    setKameraOpen(false);
    setUploadBusy(true);
    const uid = (await supabase.auth.getUser()).data.user.id;
    const ext = file.name.split(".").pop();
    const path = `${today}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from("absensi").upload(path, file);
    if (upErr) {
      setUploadBusy(false);
      alert("Gagal upload foto: " + upErr.message);
      return;
    }
    const { data: row, error: insErr } = await supabase
      .from("absensi_tim_foto")
      .insert({ tanggal: today, foto_url: path, created_by: uid })
      .select()
      .single();
    if (insErr) {
      setUploadBusy(false);
      alert("Gagal menyimpan foto: " + insErr.message);
      return;
    }
    const { data: s } = await supabase.storage.from("absensi").createSignedUrl(path, 3600);
    setFotos((fs) => [...fs, { id: row.id, path, url: s?.signedUrl }]);
    setUploadBusy(false);
  };

  const pilihDariGaleri = (e) => {
    const file = e.target.files?.[0];
    if (file) unggahFoto(file);
    e.target.value = "";
  };

  const hapusFoto = async (f) => {
    if (!confirm("Hapus foto ini?")) return;
    await supabase.from("absensi_tim_foto").delete().eq("id", f.id);
    await supabase.storage.from("absensi").remove([f.path]);
    setFotos((fs) => fs.filter((x) => x.id !== f.id));
  };

  const tglLabel = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  // ---------- mutasi state ----------
  const setTim = (i, patch) =>
    setTims((ts) => ts.map((t, x) => (x === i ? { ...t, ...patch } : t)));

  const setLine = (i, j, patch) =>
    setTims((ts) =>
      ts.map((t, x) =>
        x === i
          ? { ...t, lines: t.lines.map((l, y) => (y === j ? { ...l, ...patch } : l)) }
          : t
      )
    );

  const ubahJumlah = (i, j, delta) =>
    setTims((ts) =>
      ts.map((t, x) =>
        x === i
          ? {
              ...t,
              lines: t.lines.map((l, y) =>
                y === j
                  ? { ...l, jumlah: String(Math.max(0, (Number(l.jumlah) || 0) + delta)) }
                  : l
              ),
            }
          : t
      )
    );

  const tambahTim = () =>
    setTims((ts) => [...ts, { nama: "", lines: [{ jumlah: "", kegiatan: "" }] }]);
  const hapusTim = (i) => setTims((ts) => ts.filter((_, x) => x !== i));
  const tambahLine = (i) =>
    setTims((ts) =>
      ts.map((t, x) =>
        x === i ? { ...t, lines: [...t.lines, { jumlah: "", kegiatan: "" }] } : t
      )
    );
  const hapusLine = (i, j) =>
    setTims((ts) =>
      ts.map((t, x) =>
        x === i ? { ...t, lines: t.lines.filter((_, y) => y !== j) } : t
      )
    );

  // ---------- teks laporan (format final) ----------
  const barisTeks = (l) => {
    const j = Number(l.jumlah);
    return j > 0 ? `- ${j} orang ${l.kegiatan.trim()}` : `- ${l.kegiatan.trim()}`;
  };

  const teksLaporan = () => {
    let out = `Absensi Harian Tukang\n${tglLabel}\n`;
    for (const t of tims) {
      if (!t.nama.trim()) continue;
      const lines = t.lines.filter((l) => l.kegiatan.trim());
      if (!lines.length) continue;
      out += `\n${t.nama.trim()}\n`;
      for (const l of lines) out += `${barisTeks(l)}\n`;
    }
    return out.trimEnd();
  };

  const totalOrang = tims.reduce(
    (s, t) =>
      s +
      t.lines
        .filter((l) => l.kegiatan.trim())
        .reduce((ss, l) => ss + (Number(l.jumlah) > 0 ? Number(l.jumlah) : 1), 0),
    0
  );

  // ---------- aksi ----------
  const salin = async () => {
    await navigator.clipboard.writeText(teksLaporan());
    setPesan("Laporan tersalin ✓");
    setTimeout(() => setPesan(""), 2500);
  };

  const simpan = async () => {
    setBusy(true);
    const uid = (await supabase.auth.getUser()).data.user.id;

    const rows = [];
    tims.forEach((t, ti) => {
      if (!t.nama.trim()) return;
      t.lines.forEach((l, li) => {
        if (!l.kegiatan.trim()) return;
        rows.push({
          tanggal: today,
          tim: t.nama.trim(),
          jumlah: Number(l.jumlah) > 0 ? Number(l.jumlah) : null,
          kegiatan: l.kegiatan.trim(),
          urutan: ti * 100 + li,
          created_by: uid,
        });
      });
    });

    const { error: delErr } = await supabase
      .from("absensi_tim")
      .delete()
      .eq("tanggal", today);
    const { error: insErr } = rows.length
      ? await supabase.from("absensi_tim").insert(rows)
      : {};

    setBusy(false);
    if (delErr || insErr) {
      alert("Gagal menyimpan: " + (delErr?.message || insErr?.message));
      return;
    }
    setPesan("Absensi tersimpan ✓");
    setTimeout(() => setPesan(""), 2500);
    router.refresh();
  };

  return (
    <main className="p-4 pb-28">
      {kameraOpen && (
        <KameraModal
          title="Dokumentasi Absensi"
          onCapture={unggahFoto}
          onClose={() => setKameraOpen(false)}
        />
      )}
      <BackButton href="/supervisor" />
      <h1 className="text-xl font-bold tracking-tight">Absensi Harian Tukang</h1>
      <p className="mb-4 text-sm capitalize text-gray-500">{tglLabel}</p>

      <div className="card mb-4 flex items-center justify-between p-4">
        <p className="text-sm text-gray-500">Total orang hari ini</p>
        <p className="text-2xl font-bold text-emerald-600">{totalOrang}</p>
      </div>

      {/* Editor per tim */}
      <div className="space-y-4">
        {tims.map((t, i) => (
          <div key={i} className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <input
                value={t.nama}
                onChange={(e) => setTim(i, { nama: e.target.value })}
                placeholder="Nama tim — contoh: Tim mang ndan"
                className="input flex-1 font-semibold"
              />
              {tims.length > 1 && (
                <button
                  type="button"
                  onClick={() => hapusTim(i)}
                  className="shrink-0 rounded-full bg-red-50 p-2 text-red-500 active:bg-red-100"
                  title="Hapus tim"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {t.lines.map((l, j) => (
                <div key={j} className="flex items-center gap-2">
                  {/* Counter jumlah orang */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => ubahJumlah(i, j, -1)}
                      className="h-8 w-8 rounded-full bg-gray-100 font-bold text-gray-600 active:bg-gray-200"
                    >
                      −
                    </button>
                    <input
                      inputMode="numeric"
                      value={l.jumlah}
                      onChange={(e) =>
                        setLine(i, j, { jumlah: e.target.value.replace(/\D/g, "").slice(0, 3) })
                      }
                      placeholder="–"
                      className="h-8 w-9 rounded-lg border border-gray-200 text-center text-sm font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-brand"
                      title="Jumlah orang (kosongkan untuk baris bernama)"
                    />
                    <button
                      type="button"
                      onClick={() => ubahJumlah(i, j, 1)}
                      className="h-8 w-8 rounded-full bg-brand font-bold text-white active:opacity-80"
                    >
                      +
                    </button>
                  </div>
                  <input
                    value={l.kegiatan}
                    onChange={(e) => setLine(i, j, { kegiatan: e.target.value })}
                    placeholder="Kegiatan — contoh: ke SS cleaning."
                    className="input flex-1 !py-2 text-sm"
                  />
                  {t.lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => hapusLine(i, j)}
                      className="shrink-0 p-1 text-gray-300 active:text-red-500"
                      title="Hapus baris"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => tambahLine(i)}
              className="mt-3 text-sm font-semibold text-brand active:opacity-70"
            >
              + Tambah Kegiatan
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={tambahTim}
        className="mt-4 w-full rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-semibold text-gray-500 active:bg-gray-50"
      >
        + Tambah Tim
      </button>

      {/* Dokumentasi */}
      <h2 className="mt-6 mb-2 font-bold text-gray-700">Dokumentasi</h2>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKameraOpen(true)}
          disabled={uploadBusy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 active:bg-gray-50 disabled:opacity-50"
        >
          <Icon name="camera" className="h-5 w-5 text-gray-400" />
          Kamera
        </button>
        <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 active:bg-gray-50">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 21h18M6.75 6.75h.008v.008H6.75V6.75z" />
          </svg>
          Galeri
          <input type="file" accept="image/*" className="hidden" onChange={pilihDariGaleri} />
        </label>
      </div>
      {uploadBusy && (
        <p className="mt-2 text-xs text-gray-400">Mengunggah foto...</p>
      )}
      {fotos.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {fotos.map((f) => (
            <div key={f.id} className="relative">
              <img
                src={f.url}
                alt="dokumentasi absensi"
                className="aspect-square w-full rounded-xl border border-gray-200 object-cover"
              />
              <button
                type="button"
                onClick={() => hapusFoto(f)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preview format laporan */}
      <h2 className="mt-6 mb-2 font-bold text-gray-700">Preview Laporan</h2>
      <div className="card p-4">
        <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">{teksLaporan()}</pre>
      </div>

      <RiwayatLaporanCard riwayat={riwayat} />

      {/* Aksi */}
      <div className="fixed inset-x-0 bottom-14 z-40 mx-auto flex max-w-md gap-2 border-t border-gray-200 bg-white/95 p-3 backdrop-blur">
        <button
          type="button"
          onClick={salin}
          className="flex-1 rounded-xl border-2 border-brand bg-white py-3 text-sm font-bold text-brand active:bg-brand-50"
        >
          Salin Laporan
        </button>
        <button
          type="button"
          onClick={simpan}
          disabled={busy}
          className="btn-primary flex-1 rounded-xl py-3 text-sm font-bold disabled:opacity-60"
        >
          {busy ? "Menyimpan..." : pesan || "SIMPAN"}
        </button>
      </div>
    </main>
  );
}
