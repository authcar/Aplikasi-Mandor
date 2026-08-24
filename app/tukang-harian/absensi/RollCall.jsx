"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";
import KameraModal from "@/components/KameraModal";
import { kompresGambar } from "@/lib/gambar";

export default function RollCall({
  proyek,
  jumlahHadirAwal,
  tidakAdaPengerjaanAwal = false,
  fotoTerupload = [],
}) {
  const router = useRouter();
  const supabase = createClient();
  const [jumlah, setJumlah] = useState(jumlahHadirAwal ?? 0);
  const [tidakAda, setTidakAda] = useState(tidakAdaPengerjaanAwal);
  const [saving, setSaving] = useState(false);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [kameraOpen, setKameraOpen] = useState(false);
  const [ok, setOk] = useState(false);
  const [uploaded, setUploaded] = useState(fotoTerupload);

  const hapusFoto = async (f) => {
    if (!confirm("Hapus foto ini?")) return;
    const { data, error } = await supabase
      .from("progres_foto")
      .delete()
      .eq("id", f.id)
      .select();
    if (error || !data?.length) {
      alert("Gagal menghapus foto. Foto hanya bisa dihapus di hari yang sama.");
      return;
    }
    await supabase.storage.from("progres").remove([f.path]);
    setUploaded((list) => list.filter((x) => x.id !== f.id));
  };

  const kurang = () => setJumlah((n) => Math.max(0, (Number(n) || 0) - 1));
  const tambah = () => setJumlah((n) => (Number(n) || 0) + 1);

  const ketikJumlah = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 3);
    setJumlah(v === "" ? "" : parseInt(v, 10));
  };

  // Foto dikompres SEBELUM masuk state, jadi preview dan file yang diupload
  // adalah objek yang sama — HP tidak perlu menyimpan versi 8 MB-nya sama
  // sekali. Kalau kompresinya gagal, kompresGambar mengembalikan file asli.
  const pilihFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const kecil = await kompresGambar(file);
    setFoto(kecil);
    setPreview(URL.createObjectURL(kecil));
  };

  const pakaiFoto = (file) => {
    setFoto(file);
    setPreview(URL.createObjectURL(file));
    setKameraOpen(false);
  };

  const simpan = async () => {
    setSaving(true);
    const res = await fetch("/api/absensi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proyek_id: proyek.id,
        jumlah_hadir: Number(jumlah) || 0,
        tidak_ada_pengerjaan: tidakAda,
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      setSaving(false);
      alert("Gagal menyimpan: " + (json.error || "unknown error"));
      return;
    }
    if (!tidakAda && foto) {
      const ext = foto.name.split(".").pop();
      const path = `${proyek.id}/${Date.now()}.${ext}`;
      await supabase.storage.from("progres").upload(path, foto);
      await supabase.from("progres_foto").insert({
        proyek_id: proyek.id,
        foto_url: path,
        created_by: (await supabase.auth.getUser()).data.user.id,
      });
    }
    setSaving(false);
    setOk(true);
    setTimeout(() => router.push(`/tukang-harian?proyek=${proyek.id}`), 800);
  };

  if (!proyek) return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <>
      {kameraOpen && (
        <KameraModal
          title="Foto Suasana Proyek"
          onCapture={pakaiFoto}
          onClose={() => setKameraOpen(false)}
        />
      )}
      <main className="p-4 pb-40">
        <BackButton href={`/tukang-harian?proyek=${proyek.id}`} />
        <header className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">Absensi Hari Ini</h1>
          <p className="text-sm text-gray-500">{proyek.nama}</p>
        </header>

        {/* Toggle: tidak ada pengerjaan hari ini */}
        <button
          type="button"
          onClick={() => setTidakAda((v) => !v)}
          className={`card mb-5 flex w-full items-center gap-3 p-4 text-left ${
            tidakAda ? "border-2 border-amber-400 bg-amber-50" : ""
          }`}
        >
          <span
            className={`icon-tile ${tidakAda ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-400"}`}
          >
            <Icon name="x-circle" />
          </span>
          <span className="flex-1">
            <p className="font-semibold text-gray-800">Tidak Ada Pengerjaan Hari Ini</p>
            <p className="text-sm text-gray-500">Absensi hari ini tidak akan dihitung.</p>
          </span>
          <span
            className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
              tidakAda ? "bg-amber-400" : "bg-gray-200"
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                tidakAda ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>

        {tidakAda ? (
          <div className="card mb-5 p-6 text-center">
            <p className="text-sm text-gray-500">
              Tidak ada tukang yang bekerja hari ini. Jumlah hadir tidak perlu diisi.
            </p>
          </div>
        ) : (
          <>
            {/* Counter hadir */}
            <div className="card p-6 flex flex-col items-center gap-4 mb-5">
              <p className="text-sm font-medium text-gray-500">Jumlah yang Hadir</p>
              <div className="flex items-center gap-6">
                <button
                  onClick={kurang}
                  disabled={jumlah === 0}
                  className="h-14 w-14 rounded-full bg-gray-100 text-2xl font-bold text-gray-600 active:bg-gray-200 disabled:opacity-30"
                >
                  −
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={jumlah}
                  onChange={ketikJumlah}
                  onBlur={() => setJumlah((n) => (n === "" ? 0 : n))}
                  className="w-24 border-none bg-transparent text-center text-6xl font-bold tabular-nums focus:outline-none"
                  aria-label="Jumlah yang hadir"
                />
                <button
                  onClick={tambah}
                  disabled={false}
                  className="h-14 w-14 rounded-full bg-brand text-2xl font-bold text-white active:opacity-80 disabled:opacity-30"
                >
                  +
                </button>
              </div>
              <p className="text-sm text-gray-400">orang hadir</p>
            </div>

            {/* Foto suasana proyek */}
            <p className="label mb-1">Foto Suasana Proyek (opsional)</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKameraOpen(true)}
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
                <input type="file" accept="image/*" className="hidden" onChange={pilihFoto} />
              </label>
            </div>
            {preview && (
              <div className="relative mt-2">
                <img src={preview} alt="preview proyek" className="w-full max-h-52 rounded-xl border border-gray-200 object-cover" />
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

            {uploaded.length > 0 && (
              <>
                <p className="label mt-4 mb-1">Foto Terupload Hari Ini</p>
                <div className="grid grid-cols-3 gap-2">
                  {uploaded.map((f) => (
                    <div key={f.id} className="relative">
                      <img
                        src={f.url}
                        alt="foto suasana proyek"
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
              </>
            )}
          </>
        )}

        <div className="fixed inset-x-0 bottom-14 z-40 mx-auto max-w-md border-t border-gray-200 bg-white/95 p-3 backdrop-blur">
          <button
            onClick={simpan}
            disabled={saving}
            className={`btn-lg w-full ${ok ? "btn-success" : "btn-primary"}`}
          >
            {ok ? "✓ Tersimpan" : saving ? "Menyimpan..." : "SIMPAN ABSEN"}
          </button>
        </div>
      </main>
    </>
  );
}
