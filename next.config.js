/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hemat kuota: kompres response & batasi ukuran image
  compress: true,
  // Token di URL /k/... (link rahasia Portal Klien) jangan ikut terkirim ke situs lain.
  headers: async () => [{ source: "/k/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }],
  // Alamat login lama (sudah dibagikan ke tukang) diarahkan ke alamat baru.
  redirects: async () => [
    { source: "/tukang-harian-login", destination: "/login-staff", permanent: true },
    { source: "/login-mandor-tukang", destination: "/login-staff", permanent: true },
  ],
  // Cache persisten webpack sering rusak (ChunkLoadError) di folder yang
  // disinkronkan OneDrive (mis. di dalam Documents) karena file dikunci
  // saat ditulis. Matikan khusus di dev — rebuild sedikit lebih lambat,
  // tapi tidak lagi rusak.
  webpack: (config, { dev }) => {
    if (dev) config.cache = false;
    return config;
  },
};
module.exports = nextConfig;
