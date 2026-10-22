import KotaGlow from "./proyek/[id]/KotaGlow";

// Tampil seketika saat berpindah halaman portal, selagi data dimuat di server.
export default function Memuat() {
  return (
    <main className="wrap" aria-busy="true" aria-label="Memuat">
      <div className="sk sk-judul" />
      <div className="stat lead sk-lead"><KotaGlow /></div>
      <div className="sk sk-kartu" />
      <div className="sk sk-kartu" />
      <div className="sk sk-kartu pendek" />
    </main>
  );
}
