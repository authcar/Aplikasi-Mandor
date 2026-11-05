"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { hitungJarak } from "@/lib/geo";

// Kamera selfie untuk absen, dengan stempel nama + waktu + lokasi yang
// tercetak di foto.
//
// Fotonya TIDAK PERNAH diunggah atau disimpan. Selfie ini cuma hasil jepretan
// di layar untuk dilihat orangnya sebelum menekan "Pakai"; yang dikirim ke
// server hanya koordinat (onKonfirmasi), dan jam resminya dibuat server. Jadi
// jam di stempel adalah jam HP — itu murni tampilan, bukan catatan absen.
//
// Sengaja bukan perpanjangan KameraModal: modal itu dipakai belasan form
// dengan kamera belakang, sedangkan yang ini kamera depan, butuh GPS, dan
// punya langkah pratinjau.

const SISI_MAKS = 1280;
const JARAK_CARI_LABEL_METER = 50; // minta nama proyek lagi hanya kalau sudah berpindah sejauh ini

const waktuStempel = (d) => {
  const tgl = d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const jam = d.toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Jakarta" });
  return `${tgl} · ${jam} WIB`;
};

function barisStempel({ nama, sekarang, posisi, proyek, alamat }) {
  return [
    nama,
    waktuStempel(sekarang),
    alamat,
    posisi
      ? `${posisi.lat.toFixed(5)}, ${posisi.lng.toFixed(5)} (±${Math.round(posisi.akurasi ?? 0)} m)`
      : "Mencari lokasi…",
    proyek ? `Dekat proyek: ${proyek}` : null,
  ].filter(Boolean);
}

// Alamat bisa panjang; fillText(maxWidth) akan menyempitkan hurufnya, jadi
// dipecah per baris sesuai lebar canvas.
function bungkusBaris(ctx, teks, lebarMaks) {
  const hasil = [];
  let baris = "";
  for (const kata of teks.split(" ")) {
    const calon = baris ? `${baris} ${kata}` : kata;
    if (baris && ctx.measureText(calon).width > lebarMaks) {
      hasil.push(baris);
      baris = kata;
    } else {
      baris = calon;
    }
  }
  if (baris) hasil.push(baris);
  return hasil;
}

export default function SelfieStampModal({ judul, nama, onKonfirmasi, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const terakhirCariRef = useRef(null);

  const [kameraSiap, setKameraSiap] = useState(false);
  const [errorKamera, setErrorKamera] = useState(null);
  const [posisi, setPosisi] = useState(null);
  const [errorGps, setErrorGps] = useState(null);
  const [proyek, setProyek] = useState(null);
  const [alamat, setAlamat] = useState(null);
  const [sekarang, setSekarang] = useState(() => new Date());
  const [pratinjau, setPratinjau] = useState(null); // { url, posisi } hasil jepretan
  const [menyimpan, setMenyimpan] = useState(false);
  const [errorSimpan, setErrorSimpan] = useState(null);

  // Kamera depan
  useEffect(() => {
    if (pratinjau) return undefined;
    let batal = false;
    setKameraSiap(false);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((stream) => {
        if (batal) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setKameraSiap(true);
        }
      })
      .catch(() => setErrorKamera("Kamera tidak bisa diakses. Pastikan izin kamera sudah diberikan."));
    return () => {
      batal = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [pratinjau]);

  // GPS — dipantau terus selama modal terbuka supaya akurasinya membaik
  // sambil orangnya bersiap, lalu dibekukan saat difoto.
  useEffect(() => {
    if (!navigator.geolocation) {
      setErrorGps("Perangkat ini tidak mendukung GPS.");
      return undefined;
    }
    // Titik awal cepat dari Wi-Fi/menara (1-3 dtk) supaya tombol foto tidak
    // menunggu GPS satelit yang di dalam ruangan bisa belasan detik. Hanya
    // dipakai kalau pantauan GPS di bawah belum memberi titik apa pun.
    let sudahAdaGps = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (sudahAdaGps) return;
        setErrorGps(null);
        setPosisi({ lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: pos.coords.accuracy });
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 0, timeout: 8000 }
    );
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        sudahAdaGps = true;
        setErrorGps(null);
        setPosisi({ lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: pos.coords.accuracy });
      },
      () => setErrorGps("Lokasi belum didapat. Izinkan akses lokasi dan nyalakan GPS."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Jam di stempel berdetak
  useEffect(() => {
    if (pratinjau) return undefined;
    const t = setInterval(() => setSekarang(new Date()), 1000);
    return () => clearInterval(t);
  }, [pratinjau]);

  // Nama proyek terdekat + alamat — hanya label, gagal pun tidak apa-apa.
  useEffect(() => {
    if (!posisi) return;
    const t = terakhirCariRef.current;
    if (t && hitungJarak(posisi.lat, posisi.lng, t.lat, t.lng) < JARAK_CARI_LABEL_METER) return;
    terakhirCariRef.current = { lat: posisi.lat, lng: posisi.lng };
    fetch(`/api/absensi-pegawai/lokasi?lat=${posisi.lat}&lng=${posisi.lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setProyek(j?.proyek || null);
        setAlamat(j?.alamat || null);
      })
      .catch(() => {});
  }, [posisi]);

  // Lepas object URL pratinjau saat diganti / modal ditutup.
  useEffect(() => () => pratinjau && URL.revokeObjectURL(pratinjau.url), [pratinjau]);

  const jepret = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !posisi) return;

    const skala = Math.min(1, SISI_MAKS / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.max(1, Math.round(video.videoWidth * skala));
    const h = Math.max(1, Math.round(video.videoHeight * skala));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    const ukuran = Math.max(14, Math.round(w * 0.036));
    const jarakBaris = Math.round(ukuran * 1.35);
    const pad = Math.round(ukuran * 0.7);
    ctx.font = `500 ${ukuran}px sans-serif`;
    const baris = barisStempel({ nama, sekarang: new Date(), posisi, proyek, alamat }).flatMap((teks, i) =>
      i === 0 ? [teks] : bungkusBaris(ctx, teks, w - pad * 2)
    );
    const tinggiBand = pad * 2 + jarakBaris * baris.length;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, h - tinggiBand, w, tinggiBand);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "top";
    baris.forEach((teks, i) => {
      ctx.font = `${i === 0 ? "700" : "500"} ${ukuran}px sans-serif`;
      ctx.fillText(teks, pad, h - tinggiBand + pad + i * jarakBaris, w - pad * 2);
    });

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setErrorSimpan(null);
        setPratinjau({ url: URL.createObjectURL(blob), posisi });
      },
      "image/jpeg",
      0.85
    );
  }, [nama, posisi, proyek, alamat]);

  const pakai = async () => {
    if (!pratinjau || menyimpan) return;
    setMenyimpan(true);
    setErrorSimpan(null);
    const galat = await onKonfirmasi({
      lat: pratinjau.posisi.lat,
      lng: pratinjau.posisi.lng,
      accuracy: pratinjau.posisi.akurasi,
    });
    // Sukses: parent menutup modal. Gagal: tetap di pratinjau supaya bisa dicoba lagi.
    if (galat) {
      setErrorSimpan(galat);
      setMenyimpan(false);
    }
  };

  const baris = barisStempel({ nama, sekarang, posisi, proyek, alamat });
  const siapJepret = kameraSiap && !!posisi;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose} disabled={menyimpan} className="text-white disabled:opacity-40" aria-label="Tutup">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white">{judul}</span>
        <div className="w-6" />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {pratinjau ? (
          <img src={pratinjau.url} alt="Pratinjau selfie absen" className="absolute inset-0 h-full w-full object-contain" />
        ) : errorKamera ? (
          <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-red-400">{errorKamera}</p>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain" />
            {/* Pratinjau stempel yang akan tercetak di foto */}
            <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-white">
              {baris.map((teks, i) => (
                <p key={i} className={`text-xs leading-snug ${i === 0 ? "font-bold" : ""}`}>
                  {teks}
                </p>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 px-4 pb-8 pt-4">
        {pratinjau ? (
          <>
            {errorSimpan && <p className="mb-3 text-center text-sm text-red-400">{errorSimpan}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setPratinjau(null)}
                disabled={menyimpan}
                className="flex-1 rounded-xl border border-white/30 py-3 text-sm font-semibold text-white active:bg-white/10 disabled:opacity-40"
              >
                Ulangi
              </button>
              <button
                onClick={pakai}
                disabled={menyimpan}
                className="flex-1 rounded-xl bg-white py-3 text-sm font-bold text-gray-900 active:bg-gray-200 disabled:opacity-60"
              >
                {menyimpan ? "Menyimpan…" : "Pakai"}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {errorGps ? (
              <p className="text-center text-xs text-red-400">{errorGps}</p>
            ) : !posisi ? (
              <p className="text-xs text-white/70">Mencari lokasi…</p>
            ) : null}
            <button
              onClick={jepret}
              disabled={!siapJepret}
              aria-label="Ambil foto"
              className="h-16 w-16 rounded-full border-4 border-white bg-white/20 active:bg-white/40 disabled:opacity-30"
            />
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
