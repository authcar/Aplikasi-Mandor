"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TARGET = { lat: -6.215008633327863, lng: 106.73600688186137 };
const RADIUS_METER = 500;
const JAM_MASUK = 8;   // 08:00 WIB
const JAM_PULANG = 17; // 17:00 WIB
const TOLERANSI_TELAT_JAM = 0.5; // 30 menit toleransi sebelum dianggap telat

function hitungJarak(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function jamWIB() {
  return new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false });
}

function formatJam(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
}

function totalJamKerja(checkinAt, checkoutAt) {
  if (!checkinAt || !checkoutAt) return "--:--";
  const ms = new Date(checkoutAt) - new Date(checkinAt);
  if (ms <= 0) return "--:--";
  const totalMenit = Math.round(ms / 60000);
  const h = Math.floor(totalMenit / 60);
  const m = totalMenit % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// mode: "idle" | "masuk" | "pulang"
export default function AbsensiSayaCard({ chatId, sudahCheckin, sudahCheckout, checkinAt: initialCheckinAt, checkoutAt: initialCheckoutAt }) {
  const supabase = createClient();
  const [mode, setMode] = useState(
    sudahCheckout ? "pulang" : sudahCheckin ? "masuk" : "idle"
  );
  const [checkinAt, setCheckinAt] = useState(initialCheckinAt || null);
  const [checkoutAt, setCheckoutAt] = useState(initialCheckoutAt || null);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState(null); // { late: bool, jam: string } | null

  const jamSekarang = Number(jamWIB());
  const bolehMasuk = jamSekarang >= JAM_MASUK;
  const bolehPulang = jamSekarang >= JAM_PULANG;

  const cekLokasi = (onSuccess) => {
    setLoading(true);
    setPesan("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const jarak = hitungJarak(pos.coords.latitude, pos.coords.longitude, TARGET.lat, TARGET.lng);
        if (jarak <= RADIUS_METER) {
          onSuccess();
        } else {
          setPesan(`Terlalu jauh (${Math.round(jarak)}m)`);
          setLoading(false);
          setTimeout(() => setPesan(""), 3000);
        }
      },
      () => {
        setPesan("Izinkan akses GPS terlebih dahulu");
        setLoading(false);
        setTimeout(() => setPesan(""), 3000);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleMasuk = () => {
    if (!bolehMasuk) {
      setPesan(`Absen masuk mulai jam ${JAM_MASUK}:00`);
      setTimeout(() => setPesan(""), 3000);
      return;
    }
    cekLokasi(async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const { error } = await supabase.from("checkin_harian").upsert(
        { chat_id: chatId, tanggal: today, checkin_at: now.toISOString(), checkout_at: null },
        { onConflict: "chat_id,tanggal" }
      );
      setLoading(false);
      if (error) {
        setPesan("Gagal menyimpan absen: " + error.message);
        setTimeout(() => setPesan(""), 4000);
        return;
      }
      setMode("masuk");
      setCheckinAt(now.toISOString());
      const late = jamSekarang > JAM_MASUK + TOLERANSI_TELAT_JAM;
      setFeedback({ late, jam: formatJam(now.toISOString()) });
      setTimeout(() => setFeedback(null), 2500);
    });
  };

  const handlePulang = () => {
    if (!bolehPulang) {
      setPesan(`Belum boleh pulang sebelum jam ${JAM_PULANG}:00`);
      setTimeout(() => setPesan(""), 3000);
      return;
    }
    cekLokasi(async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const { error } = await supabase
        .from("checkin_harian")
        .update({ checkout_at: now.toISOString() })
        .eq("chat_id", chatId)
        .eq("tanggal", today);
      setLoading(false);
      if (error) {
        setPesan("Gagal menyimpan absen: " + error.message);
        setTimeout(() => setPesan(""), 4000);
        return;
      }
      setMode("pulang");
      setCheckoutAt(now.toISOString());
      setPesan("Absen pulang tercatat ✓");
    });
  };

  const config = {
    idle:   { label: bolehMasuk ? "Belum Absen" : `Absen mulai jam ${JAM_MASUK}:00`, sub: bolehMasuk ? "Tap untuk absen masuk" : "Belum waktunya", color: "from-brand to-indigo-500", icon: <IconTangan />, tombol: "ABSEN\nMASUK" },
    masuk:  { label: "Sudah Masuk",   sub: bolehPulang ? "Tap untuk absen pulang" : `Pulang ab ${JAM_PULANG}:00`, color: "from-amber-400 to-orange-500", icon: <IconTangan />, tombol: "ABSEN\nPULANG" },
    pulang: { label: "Sudah Pulang",  sub: "Absensi selesai hari ini", color: "from-green-400 to-emerald-500", icon: <IconCheck />, tombol: "SELESAI" },
  };

  const c = config[mode];
  const isDisabled = loading || mode === "pulang" || (mode === "idle" && !bolehMasuk) || (mode === "masuk" && !bolehPulang);
  const handleTap = mode === "idle" ? handleMasuk : mode === "masuk" ? handlePulang : undefined;

  const confirmText =
    mode === "idle"
      ? { title: "Absen Masuk?", sub: "Pastikan kamu sudah berada di lokasi proyek." }
      : { title: "Absen Pulang?", sub: checkinAt ? `Kamu sudah bekerja sejak ${formatJam(checkinAt)}.` : "Konfirmasi absen pulang." };

  return (
    <div className="relative">
      <div className="card p-6 mb-3 flex flex-col items-center gap-3 text-center">
        <div className="flex w-full items-center justify-between">
          <p className="font-bold text-gray-700 text-sm">Absensi Saya</p>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${
            mode === "pulang" ? "bg-green-100 text-green-700"
            : mode === "masuk" ? "bg-amber-100 text-amber-700"
            : "bg-gray-100 text-gray-500"
          }`}>
            {mode === "pulang" ? "SELESAI" : mode === "masuk" ? "MASUK" : "BELUM"}
          </span>
        </div>

        {/* Tombol */}
        <div className="relative flex items-center justify-center shrink-0 my-1">
          <span className={`absolute w-28 h-28 rounded-full animate-[breathe_2.2s_ease-in-out_infinite] bg-gradient-to-br ${
            mode === "idle" ? "from-brand via-indigo-400 to-purple-500"
            : mode === "masuk" ? "from-amber-400 to-orange-500"
            : "from-green-400 to-emerald-500"
          }`} />
          <button
            onClick={() => (isDisabled ? undefined : setConfirmOpen(true))}
            disabled={isDisabled}
            className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center gap-0.5 shadow-lg transition-all duration-300 active:scale-95 disabled:opacity-60 bg-gradient-to-br ${c.color}`}
          >
            {loading ? (
              <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            ) : (
              <>
                {c.icon}
                <span className="text-[11px] font-bold leading-tight text-white whitespace-pre-line">{c.tombol}</span>
              </>
            )}
          </button>
        </div>

        {!isDisabled && (
          <p className="text-sm font-semibold text-brand"></p>
        )}

        {/* Teks */}
        <div className="min-w-0">
          <p className={`text-sm font-medium ${
            mode === "pulang" ? "text-green-600"
            : mode === "masuk" ? "text-amber-600"
            : "text-gray-500"
          }`}>
            {pesan || c.label}
          </p>
          <p className="text-xs text-gray-400 truncate">{pesan ? c.sub : "Jl. H. Sa'aba No.98, Joglo · Jak-Bar"}</p>
        </div>

        {/* Stats: Masuk / Pulang / Total Jam */}
        <div className="mt-1 grid w-full grid-cols-3 divide-x divide-amber-200 rounded-xl border border-amber-200 bg-amber-50/50 py-2.5">
          <Stat icon={<IconMasukKecil />} value={formatJam(checkinAt)} label="Masuk" />
          <Stat icon={<IconPulangKecil />} value={formatJam(checkoutAt)} label="Pulang" />
          <Stat icon={<IconJamKecil />} value={totalJamKerja(checkinAt, checkoutAt)} label="Total jam" />
        </div>
      </div>

      {/* Modal konfirmasi */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-base font-bold text-gray-800">{confirmText.title}</p>
            <p className="mt-1 text-sm text-gray-500">{confirmText.sub}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 active:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  handleTap?.();
                }}
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-brand active:bg-brand-800"
              >
                Ya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback tepat waktu / telat setelah absen masuk */}
      {feedback && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6">
          <div className={`w-full max-w-xs rounded-2xl border p-6 text-center shadow-xl ${
            feedback.late ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"
          }`}>
            <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
              feedback.late ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
            }`}>
              {feedback.late ? <IconWarning /> : <IconCheck2 />}
            </div>
            <p className="font-bold text-gray-800">
              {feedback.late ? "Yah, Kamu Terlambat!" : "Kamu Tepat Waktu!"}
            </p>
            <p className="mt-1 text-sm text-gray-500">Absen masuk jam {feedback.jam}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, value, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1">
      {icon}
      <p className="text-sm font-bold text-gray-700 tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}

function IconTangan() {
  return (
    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M22 14a8 8 0 0 1-8 8" />
      <path d="M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" />
      <path d="M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10" />
      <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconCheck2() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

function IconMasukKecil() {
  return (
    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10m0 0 4-4m-4 4-4-4M4 18h16" />
    </svg>
  );
}

function IconPulangKecil() {
  return (
    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V10m0 0-4 4m4-4 4 4M4 6h16" />
    </svg>
  );
}

function IconJamKecil() {
  return (
    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  );
}
