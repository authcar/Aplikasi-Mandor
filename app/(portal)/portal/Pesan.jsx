"use client";

// Pop up loading selama aksi berjalan dan data baru dimuat, lalu pesan hasil
// aksi yang melayang di atas navigasi bawah supaya tetap terlihat walau sedang
// menggulir jauh. Ketuk pesan untuk menutup.
export default function Pesan({ aksi }) {
  const gagal = aksi.msg.startsWith("Gagal");
  return (
    <>
      {aksi.sibuk && (
        <div className="memuat" role="status" aria-live="polite">
          <div className="memuat-k"><span className="putar" aria-hidden="true" />Menyimpan…</div>
        </div>
      )}
      {aksi.msg && (
        <button type="button" className={`toast ${gagal ? "b-bad" : "b-ok"}`} role="status" onClick={() => aksi.setMsg("")}>
          {aksi.msg}
        </button>
      )}
    </>
  );
}
