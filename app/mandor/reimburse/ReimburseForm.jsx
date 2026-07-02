"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";

export default function ReimburseForm({ proyek }) {
  const router = useRouter();
  const [nominal, setNominal] = useState("");
  const [ket, setKet] = useState("");
  const [nota, setNota] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [kameraOpen, setKameraOpen] = useState(false);

  const pilihFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNota(file);
    setPreview(URL.createObjectURL(file));
  };

  const pakaiFoto = (file) => {
    setNota(file);
    setPreview(URL.createObjectURL(file));
    setKameraOpen(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    fd.append("proyek_id", proyek.id);
    fd.append("jenis", "REIMBURSE");
    fd.append("nominal", nominal);
    fd.append("keterangan", ket);
    if (nota) fd.append("nota", nota);
    const res = await fetch("/api/keuangan", { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) router.push(`/mandor?proyek=${proyek.id}`);
    else alert("Gagal mengirim. Coba lagi.");
  };

  if (!proyek) return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <>
      {kameraOpen && (
        <KameraModal onCapture={pakaiFoto} onClose={() => setKameraOpen(false)} />
      )}
      <main className="p-4">
        <BackButton href={`/mandor?proyek=${proyek.id}`} />
        <h1 className="text-xl font-bold tracking-tight">Reimburse / Klaim</h1>
        <p className="mb-4 text-sm text-gray-500">{proyek.nama}</p>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nominal (Rp)">
            <input
              inputMode="numeric"
              value={nominal}
              onChange={(e) => setNominal(e.target.value.replace(/\D/g, ""))}
              className="input text-lg"
              placeholder="50000"
              required
            />
          </Field>
          <Field label="Untuk apa?">
            <input
              value={ket}
              onChange={(e) => setKet(e.target.value)}
              className="input text-lg"
              placeholder="Uang makan tim"
              required
            />
          </Field>

          <Field label="Foto Nota / Kuitansi">
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
                <img src={preview} alt="preview nota" className="w-full max-h-52 rounded-xl border border-gray-200 object-cover" />
                <button
                  type="button"
                  onClick={() => { setNota(null); setPreview(null); }}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </Field>

          <button disabled={busy} className="btn-primary btn-lg w-full">
            {busy ? "Mengirim..." : "KIRIM KE SUPERVISOR"}
          </button>
        </form>
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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose} className="text-white">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white">Foto Nota</span>
        <div className="w-6" />
      </div>

      {/* Viewfinder */}
      <div className="flex flex-1 items-center justify-center">
        {error ? (
          <p className="px-8 text-center text-sm text-red-400">{error}</p>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {/* Tombol capture */}
      {siap && (
        <div className="flex justify-center pb-10 pt-6">
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

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
