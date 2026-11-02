/** @type {import('tailwindcss').Config} */

// Palet "Japandi" yang sama dengan Taraco Project Tracker (PALETTE di
// Taraco-Project-Management/src/App.jsx): kanvas abu terang, tinta hampir
// hitam, abu kayu walnut/oak. Warna hanya dipakai untuk STATUS:
// sage (zaitun) = ok, kuning tua = peringatan, bata = buruk.
//
// Seluruh kelas warna bawaan Tailwind yang sudah dipakai di app (gray-*, blue-*,
// green-*, red-*, amber-* dst.) dipetakan ulang ke palet ini, jadi ratusan
// halaman ikut berganti tanpa mengubah satu per satu.

// Netral hangat — skala utama (gray) & juga dipakai untuk "warna info" (biru, ungu, dst.).
const netral = {
  50: "#F5F5F5", // kanvas
  100: "#EDEDED", // isian lembut (input, hover)
  200: "#E3E1E1", // garis / chip
  300: "#CFCDCD",
  400: "#757171", // teks paling lemah — tetap >= 4.5:1 di atas putih (AA)
  500: "#5F5C5C", // teks sekunder
  600: "#4A4646", // kayu (wood)
  700: "#3A3737",
  800: "#2B2929",
  900: "#1F1D1D", // tinta
  950: "#151313",
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

        // Aksen tunggal = tinta pekat. DEFAULT dipertahankan agar `bg-brand`, `text-brand` dll tetap jalan.
        brand: {
          DEFAULT: "#1F1D1D",
          50: "#F5F5F5",
          100: "#E8E8E8",
          200: "#DEDCDC",
          300: "#A5A2A2",
          500: "#4A4646", // kayu — cincin fokus
          600: "#2B2929",
          700: "#1F1D1D",
          800: "#151313",
          900: "#1F1D1D",
        },

        // Warna "info" (biru, ungu, dst.) tidak dipakai di tracker -> jadi netral kayu.
        blue: netral,
        indigo: netral,
        sky: netral,
        cyan: netral,
        purple: netral,
        violet: netral,
        fuchsia: netral,
        pink: netral,

        green: sage,
        emerald: sage,
        lime: sage,
        teal: sage,

        red: bata,
        rose: bata,

        amber: kuning,
        orange: kuning,
        yellow: kuning,
      },
      boxShadow: {
        // Sama dengan .card di tracker: highlight tipis di atas + bayangan lembut panjang.
        card: "inset 0 1px 0 rgb(255 255 255 / 0.8), 0 1px 2px rgb(31 29 29 / 0.06), 0 14px 30px -18px rgb(31 29 29 / 0.28)",
        soft: "0 14px 30px -14px rgb(31 29 29 / 0.30)",
        brand: "0 8px 20px -6px rgb(31 29 29 / 0.45)",
      },
      transitionTimingFunction: {
        // Kurva "spring-out" khas tracker.
        tracker: "cubic-bezier(0.2, 0.9, 0.25, 1)",
      },
    },
  },
  plugins: [],
};
