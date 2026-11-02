/** @type {import('tailwindcss').Config} */

// Palet dasar dari Taraco Project Tracker (PALETTE di Taraco-Project-Management/src/App.jsx),
// dipertegas ke hitam-putih: kanvas putih/abu sangat terang, tinta hitam pekat.
// Warna status: sage (zaitun) = ok, kuning tua = peringatan, bata = buruk.
//
// Skala netral (gray-*), brand, dan warna status (green/red/amber) dipetakan ulang ke
// palet ini, jadi ratusan halaman ikut berganti tanpa mengubah satu per satu.
// Hitam-putih jadi dasar yang tegas; warna aksen (biru, ungu, oranye, ...) tetap ada.

// Netral murni — skala utama (gray).
const netral = {
  50: "#F7F7F7", // kanvas
  100: "#EFEFEF", // isian lembut (input, hover)
  200: "#E2E2E2", // garis / chip
  300: "#CFCFCF",
  400: "#6E6E6E", // teks paling lemah — tetap >= 4.5:1 di atas putih (AA)
  500: "#525252", // teks sekunder
  600: "#3A3A3A",
  700: "#262626",
  800: "#141414",
  900: "#0A0A0A", // tinta — hitam pekat
  950: "#000000",
};

// Sage — ok / selesai / positif
const sage = {
  50: "#F1F4EA",
  100: "#E0E6D2",
  200: "#CAD5B6",
  300: "#A9BA90",
  400: "#809A66",
  500: "#5F7C48",
  600: "#4F6B3A",
  700: "#3F5730",
  800: "#32452A",
  900: "#26351F",
};

// Bata — buruk / hapus / peringatan keras
const bata = {
  50: "#FBF1EE",
  100: "#F1D9D0",
  200: "#E6BFB2",
  300: "#D49A88",
  400: "#C06F5A",
  500: "#B24A38",
  600: "#A3402F",
  700: "#8A3526",
  800: "#712C20",
  900: "#5A231A",
};

// Kuning tua — perhatian / menunggu
const kuning = {
  50: "#FBF5E8",
  100: "#F1E1C6",
  200: "#E6CC9F",
  300: "#D9B473",
  400: "#C89A4A",
  500: "#B07A22",
  600: "#9A5B12",
  700: "#86500F",
  800: "#6B400E",
  900: "#55330C",
};

module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Poppins di mana-mana (UI, judul, angka) — sama dengan tracker.
        sans: ["var(--font-poppins)", "Poppins", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        gray: netral,
        slate: netral,
        zinc: netral,
        neutral: netral,
        stone: netral,

        // Warna utama = hitam pekat. DEFAULT dipertahankan agar `bg-brand`, `text-brand` dll tetap jalan.
        brand: {
          DEFAULT: "#0A0A0A",
          50: "#F7F7F7",
          100: "#EDEDED",
          200: "#DADADA",
          300: "#A3A3A3",
          500: "#3A3A3A", // cincin fokus
          600: "#1A1A1A",
          700: "#0A0A0A",
          800: "#000000",
          900: "#000000",
        },

        // Biru, ungu, indigo, sky, oranye, dst. SENGAJA tidak dipetakan: dibiarkan warna
        // bawaan Tailwind sebagai AKSEN (ikon, tombol absen, highlight) di atas dasar hitam-putih.

        green: sage,
        emerald: sage,

        red: bata,
        rose: bata,

        amber: kuning,
      },
      boxShadow: {
        // Sama dengan .card di tracker: highlight tipis di atas + bayangan lembut panjang.
        card: "inset 0 1px 0 rgb(255 255 255 / 0.8), 0 1px 2px rgb(0 0 0 / 0.06), 0 14px 30px -18px rgb(0 0 0 / 0.28)",
        soft: "0 14px 30px -14px rgb(0 0 0 / 0.30)",
        brand: "0 8px 20px -6px rgb(0 0 0 / 0.45)",
      },
      transitionTimingFunction: {
        // Kurva "spring-out" khas tracker.
        tracker: "cubic-bezier(0.2, 0.9, 0.25, 1)",
      },
    },
  },
  plugins: [],
};
