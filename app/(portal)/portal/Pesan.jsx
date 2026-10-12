"use client";

// Pesan hasil aksi, melayang di atas navigasi bawah supaya tetap terlihat
// walau sedang menggulir jauh. Ketuk untuk menutup.
export default function Pesan({ aksi }) {
  if (!aksi.msg) return null;
  const gagal = aksi.msg.startsWith("Gagal");
  return (
    <button type="button" className={`toast ${gagal ? "b-bad" : "b-ok"}`} role="status" onClick={() => aksi.setMsg("")}>
      {aksi.msg}
    </button>
  );
}
