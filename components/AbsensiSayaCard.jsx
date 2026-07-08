"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TARGET = { lat: -6.215008633327863, lng: 106.73600688186137 };
const RADIUS_METER = 500;
const JAM_MASUK = 8;   // 08:00 WIB
const JAM_PULANG = 17; // 17:00 WIB

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

// mode: "idle" | "masuk" | "pulang"
export default function AbsensiSayaCard({ chatId, sudahCheckin, sudahCheckout }) {
  const supabase = createClient();
  const [mode, setMode] = useState(
    sudahCheckout ? "pulang" : sudahCheckin ? "masuk" : "idle"
  );
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState("");

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
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from("checkin_harian").upsert(
        { chat_id: chatId, tanggal: today, checkout_at: null },
        { onConflict: "chat_id,tanggal" }
      );
      setMode("masuk");
      setPesan("Absen masuk tercatat ✓");
      setLoading(false);
    });
  };

  const handlePulang = () => {
    if (!bolehPulang) {
      setPesan(`Belum boleh pulang sebelum jam ${JAM_PULANG}:00`);
      setTimeout(() => setPesan(""), 3000);
      return;
    }
    cekLokasi(async () => {
      const today = new Date().toISOString().slice(0, 10);
      await supabase
        .from("checkin_harian")
        .update({ checkout_at: new Date().toISOString() })
        .eq("chat_id", chatId)
        .eq("tanggal", today);
      setMode("pulang");
      setPesan("Absen pulang tercatat ✓");
      setLoading(false);
    });
  };

  const config = {
    idle:   { label: bolehMasuk ? "Belum Absen" : `Absen mulai jam ${JAM_MASUK}:00`, sub: bolehMasuk ? "Tap untuk absen masuk" : "Belum waktunya", color: "from-brand to-indigo-500", icon: <IconLokasi /> },
    masuk:  { label: "Sudah Masuk",   sub: bolehPulang ? "Tap untuk absen pulang" : `Pulang ab ${JAM_PULANG}:00`, color: "from-amber-400 to-orange-500", icon: <IconPulang /> },
    pulang: { label: "Sudah Pulang",  sub: "Absensi selesai hari ini", color: "from-green-400 to-emerald-500", icon: <IconCheck /> },
  };

  const c = config[mode];
  const isDisabled = loading || mode === "pulang" || (mode === "idle" && !bolehMasuk) || (mode === "masuk" && !bolehPulang);
  const handleTap = mode === "idle" ? handleMasuk : mode === "masuk" ? handlePulang : undefined;

  return (
    <div className="card px-4 py-3 mb-3 flex items-center gap-4">
      {/* Tombol */}
      <div className="relative flex items-center justify-center shrink-0">
        <span className={`absolute w-14 h-14 rounded-full transition-all duration-500 ${
          mode === "idle" ? "bg-gradient-to-br from-brand via-indigo-400 to-purple-500 opacity-20 animate-[spin_4s_linear_infinite]"
          : mode === "masuk" ? "bg-gradient-to-br from-amber-400 to-orange-500 opacity-25 animate-pulse"
          : "bg-gradient-to-br from-green-400 to-emerald-500 opacity-25"
        }`} />
        <button
          onClick={handleTap}
          disabled={isDisabled}
          className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center shadow transition-all duration-300 active:scale-95 disabled:opacity-60 bg-gradient-to-br ${c.color}`}
        >
          {loading
            ? <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            : c.icon
          }
        </button>
      </div>

      {/* Teks */}
      <div className="min-w-0 flex-1">
        <p className="font-bold text-gray-700 text-sm">Absensi Saya</p>
        <p className={`text-xs font-medium mt-0.5 ${
          mode === "pulang" ? "text-green-600"
          : mode === "masuk" ? "text-amber-600"
          : "text-gray-500"
        }`}>
          {pesan || c.label}
        </p>
        <p className="text-xs text-gray-400 truncate">{pesan ? c.sub : "Jl. H. Sa'aba No.98, Joglo · Jak-Bar"}</p>
      </div>

      {/* Badge status */}
      <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${
        mode === "pulang" ? "bg-green-100 text-green-700"
        : mode === "masuk" ? "bg-amber-100 text-amber-700"
        : "bg-gray-100 text-gray-500"
      }`}>
        {mode === "pulang" ? "SELESAI" : mode === "masuk" ? "MASUK" : "BELUM"}
      </span>
    </div>
  );
}

function IconLokasi() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function IconPulang() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
