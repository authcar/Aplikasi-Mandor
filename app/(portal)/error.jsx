"use client";

// Error di halaman portal mana pun (mis. database tidak terjangkau).
export default function PortalError({ reset }) {
  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <h1>Gagal memuat</h1>
      <p className="small">Halaman ini belum bisa ditampilkan. Periksa koneksi lalu coba lagi beberapa saat lagi.</p>
      <button type="button" className="btn" onClick={() => reset()}>Coba lagi</button>
    </main>
  );
}
