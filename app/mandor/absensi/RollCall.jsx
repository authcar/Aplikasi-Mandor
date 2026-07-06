"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";

export default function RollCall({ proyek, jumlahHadirAwal, fotoTerupload = [] }) {
  const router = useRouter();
  const supabase = createClient();
  const [jumlah, setJumlah] = useState(jumlahHadirAwal ?? 0);
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

  const kurang = () => setJumlah((n) => Math.max(0, n - 1));
  const tambah = () => setJumlah((n) => n + 1);

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

  const simpan = async () => {
    setSaving(true);
    const res = await fetch("/api/absensi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proyek_id: proyek.id, jumlah_hadir: jumlah }),
    });
    const json = await res.json();
    if (!json.ok) {
      setSaving(false);
      alert("Gagal menyimpan: " + (json.error || "unknown error"));
      return;
    }
    if (foto) {
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
    setTimeout(() => router.push(`/mandor?proyek=${proyek.id}`), 800);
  };

  if (!proyek) return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <>
      {kameraOpen && (
        <KameraModal onCapture={pakaiFoto} onClose={() => setKameraOpen(false)} />
      )}
      <main className="p-4 pb-28">
        <BackButton href={`/mandor?proyek=${proyek.id}`} />
        <header className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">Absensi Hari Ini</h1>
          <p className="text-sm text-gray-500">{proyek.nama}</p>
        </header>

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
            <span className="text-6xl font-bold w-20 text-center tabular-nums">{jumlah}</span>
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

        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-gray-200 bg-white/95 p-3 backdrop-blur">
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

function KameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [siap, setSiap] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setSiap(true);
        }
      })
      .catch(() => setError("Kamera tidak bisa diakses. Pastikan izin kamera sudah diberikan."));

    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const ambilFoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onCapture(file);
    }, "image/jpeg", 0.9);
  }, [onCapture]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="text-white">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white">Foto Suasana Proyek</span>
        <div className="w-6" />
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {error ? (
          <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-red-400">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        )}
      </div>
      {siap && (
        <div className="flex shrink-0 justify-center pb-10 pt-6">
          <button
            onClick={ambilFoto}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:bg-white/40"
          />
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
