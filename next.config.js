/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hemat kuota: kompres response & batasi ukuran image
  compress: true,
};
module.exports = nextConfig;
