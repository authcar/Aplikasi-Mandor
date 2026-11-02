/** @type {import('tailwindcss').Config} */

// Palet dasar dari Taraco Project Tracker (PALETTE di Taraco-Project-Management/src/App.jsx),
// sama persis dengan portal.css (Project Tracker): kanvas #F5F5F5, tinta #1F1D1D, abu kayu.
// Warna status: sage (zaitun) = ok, kuning tua = peringatan, bata = buruk.
//
// Skala netral (gray-*), brand, dan warna status (green/red/amber) dipetakan ulang ke
// palet ini, jadi ratusan halaman ikut berganti tanpa mengubah satu per satu.
// Warna aksen (biru, ungu, oranye, ...) tetap ada tapi diredam.

// Netral murni — skala utama (gray).
const netral = {
  50: "#F5F5F5", // kanvas (--bg portal)
  100: "#EDEDED", // isian lembut (input, hover)
  200: "#E3E1E1", // garis / chip
  300: "#CFCDCD",
  400: "#757171", // teks paling lemah — tetap >= 4.5:1 di atas putih (AA)
  500: "#5F5C5C", // teks sekunder (--muted portal)
  600: "#4A4646", // kayu (--wood portal)
  700: "#3A3737",
  800: "#2B2929",
  900: "#1F1D1D", // tinta (--fg portal)
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

// Skala aksen yang DIREDAM (saturasi rendah, tidak menyala): dibangkitkan dari satu hue.
// Dipakai untuk biru, ungu, oranye, dst. supaya tetap berwarna tapi tidak terlalu terang.
function hslHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}
function redam(h, s = 42) {
  return {
    50: hslHex(h, s * 0.5, 96),
    100: hslHex(h, s * 0.65, 92),
    200: hslHex(h, s * 0.7, 85),
    300: hslHex(h, s * 0.7, 74),
    400: hslHex(h, s * 0.65, 60),
    500: hslHex(h, s * 0.7, 48),
    600: hslHex(h, s * 0.8, 40),
    700: hslHex(h, s * 0.85, 32),
    800: hslHex(h, s * 0.85, 25),
    900: hslHex(h, s * 0.85, 18),
  };
}

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
          DEFAULT: "#1F1D1D",
          50: "#F5F5F5",
          100: "#E8E8E8",
          200: "#DEDCDC",
          300: "#A5A2A2",
          500: "#4A4646", // cincin fokus
          600: "#2B2929",
          700: "#1F1D1D",
          800: "#151313",
          900: "#1F1D1D",
        },

        // Aksen berwarna tetap ada, tapi diredam (tidak menyala).
        blue: redam(214),
        indigo: redam(232),
        sky: redam(199),
        cyan: redam(187),
        teal: redam(170),
        purple: redam(268),
        violet: redam(256),
        fuchsia: redam(300),
        pink: redam(334),
        orange: redam(24, 50),
        yellow: redam(43, 50),
        lime: redam(82),

        green: sage,
        emerald: sage,

        red: bata,
        rose: bata,

        amber: kuning,
      },
      boxShadow: {
        // Sama dengan .card di tracker: highlight tipis di atas + bayangan lembut panjang.
        card: "inset 0 1px 0 rgb(255 255 255 / 0.8), 0 1px 2px rgb(31 29 29 / 0.06), 0 14px 30px -14px rgb(31 29 29 / 0.3)",
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
