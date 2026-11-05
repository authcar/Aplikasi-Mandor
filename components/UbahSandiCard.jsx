"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MIN_PANJANG = 8;

// Ubah sandi sendiri untuk akun yang login dengan email + sandi (Supervisor,
// Master, Finance, Head of Production). Mandor & Tukang masuk dengan PIN, bukan
// sandi, jadi tidak memakai kartu ini.
//
// Sandi lama diperiksa dulu dengan login ulang, supaya HP yang sedang tidak
// dijaga (sesi masih terbuka) tidak bisa dipakai orang lain untuk mengunci
// pemiliknya keluar. Penggantian memakai sesi orang itu sendiri, jadi hanya
// bisa mengubah sandi akunnya sendiri.
export default function UbahSandiCard() {
  const [buka, setBuka] = useState(false);
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [pesan, setPesan] = useState(null); // { tipe: "ok" | "galat", teks }

  const tutup = () => {
    setBuka(false);
    setLama("");
    setBaru("");
    setUlang("");
  };

  const simpan = async (e) => {
    e.preventDefault();
    setPesan(null);
    if (baru.length < MIN_PANJANG) return setPesan({ tipe: "galat", teks: `Sandi baru minimal ${MIN_PANJANG} karakter.` });
    if (baru !== ulang) return setPesan({ tipe: "galat", teks: "Ulangi sandi baru tidak sama." });
    if (baru === lama) return setPesan({ tipe: "galat", teks: "Sandi baru harus berbeda dari sandi lama." });

    setMemuat(true);
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Sesi tidak valid. Masuk ulang lalu coba lagi.");

      const { error: errLama } = await supabase.auth.signInWithPassword({ email: user.email, password: lama });
      if (errLama) throw new Error("Sandi lama salah.");

      const { error: errBaru } = await supabase.auth.updateUser({ password: baru });
      if (errBaru) throw new Error(errBaru.message || "Gagal mengubah sandi.");

      tutup();
      setPesan({ tipe: "ok", teks: "Sandi berhasil diubah ✓" });
    } catch (err) {
      setPesan({ tipe: "galat", teks: err.message || "Gagal mengubah sandi." });
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="card mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => (buka ? tutup() : setBuka(true))}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-semibold text-gray-700">Ubah Sandi</span>
        <span className="text-xs font-semibold text-brand">{buka ? "Tutup" : "Ubah"}</span>
      </button>

      {pesan && !buka && (
        <p className={`px-4 pb-3 text-xs font-medium ${pesan.tipe === "ok" ? "text-emerald-600" : "text-red-600"}`}>
          {pesan.teks}
        </p>
      )}

      {buka && (
        <form onSubmit={simpan} className="space-y-3 border-t border-gray-100 px-4 py-3">
          <div>
            <label className="label">Sandi lama</label>
            <input type="password" value={lama} onChange={(e) => setLama(e.target.value)} autoComplete="current-password" className="input" required />
          </div>
          <div>
            <label className="label">Sandi baru</label>
            <input type="password" value={baru} onChange={(e) => setBaru(e.target.value)} autoComplete="new-password" minLength={MIN_PANJANG} className="input" required />
            <p className="mt-1 text-[11px] text-gray-400">Minimal {MIN_PANJANG} karakter.</p>
          </div>
          <div>
            <label className="label">Ulangi sandi baru</label>
            <input type="password" value={ulang} onChange={(e) => setUlang(e.target.value)} autoComplete="new-password" className="input" required />
          </div>
          {pesan && (
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${pesan.tipe === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {pesan.teks}
            </p>
          )}
          <button disabled={memuat} className="btn-primary w-full">
            {memuat ? "Menyimpan..." : "SIMPAN SANDI BARU"}
          </button>
        </form>
      )}
    </div>
  );
}
