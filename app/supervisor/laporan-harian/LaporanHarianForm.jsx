"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import KameraModal from "@/components/KameraModal";
import RiwayatLaporanHarianCard from "./RiwayatLaporanHarianCard";

const STATUS_OPTIONS = [
  {
    value: "ON_PROGRESS",
    label: "Dikerjakan",
    icon: "clock",
    activeCls: "border-blue-400 bg-blue-50 text-blue-700",
    iconActiveCls: "bg-blue-500 text-white",
  },
  {
    value: "DONE",
    label: "Selesai",
    icon: "check-circle",
    activeCls: "border-green-400 bg-green-50 text-green-700",
    iconActiveCls: "bg-green-500 text-white",
  },
  {
    value: "PERBAIKAN",
    label: "Perbaikan",
    icon: "alert-triangle",
    activeCls: "border-red-400 bg-red-50 text-red-700",
    iconActiveCls: "bg-red-500 text-white",
  },
];

const ENTRI_KOSONG = () => ({
  key: crypto.randomUUID(),
  status: "ON_PROGRESS",
  deskripsi: "",
  foto: null,
  preview: null,
});

// 1 proyek per submit, tapi bisa beberapa kegiatan sekaligus — tiap
// kegiatan punya foto, deskripsi & status sendiri-sendiri (dikirim sebagai
// baris laporan_harian terpisah, satu request per kegiatan).
export default function LaporanHarianForm({ proyekList = [], riwayat = [] }) {
  const router = useRouter();
  const [proyekId, setProyekId] = useState(proyekList[0]?.id || "");
  const [entries, setEntries] = useState([ENTRI_KOSONG()]);
  const [kameraFor, setKameraFor] = useState(null); // key entri yang lagi ambil foto
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [daftar, setDaftar] = useState(riwayat);

  const setEntri = (key, patch) =>
    setEntries((es) => es.map((en) => (en.key === key ? { ...en, ...patch } : en)));

  const tambahEntri = () => setEntries((es) => [...es, ENTRI_KOSONG()]);
  const hapusEntri = (key) => setEntries((es) => (es.length > 1 ? es.filter((en) => en.key !== key) : es));

  const pilihFoto = (key, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEntri(key, { foto: file, preview: URL.createObjectURL(file) });
  };

  const pakaiFoto = (file) => {
    setEntri(kameraFor, { foto: file, preview: URL.createObjectURL(file) });
    setKameraFor(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!proyekId) return setErr("Belum ada proyek aktif.");
    if (entries.some((en) => !en.deskripsi.trim()))
      return setErr("Deskripsi kegiatan wajib diisi untuk setiap kegiatan.");

    setBusy(true);
    setErr("");

    const proyek = proyekList.find((p) => p.id === proyekId);
    const sisa = [];
    const berhasil = [];
    for (const en of entries) {
      try {
        const fd = new FormData();
        fd.append("proyek_id", proyekId);
        fd.append("deskripsi", en.deskripsi);
        fd.append("status", en.status);
        if (en.foto) fd.append("foto", en.foto);
        const res = await fetch("/api/laporan-harian", { method: "POST", body: fd });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Gagal mengirim.");
        berhasil.push({ ...json.data, proyek, fotoSignedUrl: en.preview });
      } catch (e) {
        sisa.push(en);
      }
    }

    if (berhasil.length) setDaftar((d) => [...berhasil.reverse(), ...d]);
    setBusy(false);

    if (sisa.length) {
      setEntries(sisa);
      setErr(
        `${berhasil.length} kegiatan terkirim, ${sisa.length} gagal — cek koneksi lalu coba kirim ulang sisanya.`
      );
    } else {
      setEntries([ENTRI_KOSONG()]);
      router.refresh();
    }
  };

  if (!proyekList.length) {
    return (
      <main className="p-4">
        <BackButton href="/supervisor" />
        <p className="p-6 text-center text-sm text-gray-400">Belum ada proyek aktif.</p>
      </main>
    );
  }

  return (
    <>
      {kameraFor && (
        <KameraModal title="Foto Dokumentasi" onCapture={pakaiFoto} onClose={() => setKameraFor(null)} />
      )}
      <main className="p-4 pb-8">
        <BackButton href="/supervisor" />
        <h1 className="text-xl font-bold tracking-tight">Laporan Harian</h1>
        <p className="mb-4 text-sm text-gray-500">Dokumentasi & status pekerjaan hari ini</p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Proyek">
            <select value={proyekId} onChange={(e) => setProyekId(e.target.value)} className="input text-lg">
              {proyekList.map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </Field>

          <div className="space-y-4">
            {entries.map((en, i) => (
              <div key={en.key} className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-700">Kegiatan {i + 1}</p>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => hapusEntri(en.key)}
                      className="shrink-0 rounded-full bg-red-50 p-1.5 text-red-500 active:bg-red-100"
                      title="Hapus kegiatan"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                <Field label="Status">
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map((s) => {
                      const active = en.status === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setEntri(en.key, { status: s.value })}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-2.5 text-xs font-semibold transition-colors ${
                            active ? s.activeCls : "border-gray-200 bg-white text-gray-400 active:bg-gray-50"
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                              active ? s.iconActiveCls : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            <Icon name={s.icon} className="h-4 w-4" />
                          </span>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Deskripsi Kegiatan">
                  <textarea
                    value={en.deskripsi}
                    onChange={(e) => setEntri(en.key, { deskripsi: e.target.value })}
                    placeholder="Contoh: Pemasangan keramik lantai 2 selesai 80%"
                    className="input min-h-20 text-lg"
                    required
                  />
                </Field>

                <Field label="Foto Dokumentasi">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setKameraFor(en.key)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 active:bg-gray-50"
                    >
                      <Icon name="camera" className="h-5 w-5 text-gray-400" />
                      Kamera
                    </button>
                    <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-gray-500 active:bg-gray-50">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 21h18M6.75 6.75h.008v.008H6.75V6.75z" />
                      </svg>
                      Galeri
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => pilihFoto(en.key, e)} />
                    </label>
                  </div>
                  {en.preview && (
                    <div className="relative mt-2">
                      <img src={en.preview} alt="preview dokumentasi" className="w-full max-h-52 rounded-xl border border-gray-200 object-cover" />
                      <button
                        type="button"
                        onClick={() => setEntri(en.key, { foto: null, preview: null })}
                        className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </Field>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={tambahEntri}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-semibold text-gray-500 active:bg-gray-50"
          >
            + Tambah Kegiatan
          </button>

          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{err}</p>
          )}

          <button disabled={busy} className="btn-primary btn-lg w-full">
            {busy ? "Mengirim..." : "KIRIM LAPORAN"}
          </button>
        </form>

        <RiwayatLaporanHarianCard riwayat={daftar} />
      </main>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
