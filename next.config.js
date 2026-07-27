/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hemat kuota: kompres response & batasi ukuran image
  compress: true,
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
