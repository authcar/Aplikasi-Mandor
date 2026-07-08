"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TukangLoginPage() {
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleChange = (e) => {
    setCode(e.target.value.replace(/\D/g, "").slice(0, 5));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 5) return setErr("Masukkan 5 digit nomor HP.");
    setLoading(true);
    setErr("");

    const res = await fetch("/api/tukang-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digits: code }),
    });

    const json = await res.json();
    if (!res.ok) {
      setLoading(false);
      return setErr(json.error || "Terjadi kesalahan.");
    }

    // Gunakan magic link token untuk masuk tanpa password
    const { error } = await supabase.auth.verifyOtp({
      token_hash: json.token_hash,
      type: "magiclink",
    });

    setLoading(false);
    if (error) return setErr("Gagal masuk. Coba lagi.");
    // Hard navigation (bukan router.push) supaya session baru pasti terbaca,
    // bukan RSC cache lama dari kunjungan sebelum login.
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen flex-col justify-center p-6">
      <div className="mb-8">
        <img src="/logo.png" alt="Taraco Interior" className="mb-4 h-12 w-auto" />
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Login Tukang Harian
        </h1>
        <p className="mt-1 text-gray-500">
          Masukkan 5 digit pertama nomor HP kamu
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-6 p-5">
        <div>
          <label className="label mb-3 block">5 Digit Pertama Nomor HP</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={5}
            value={code}
            onChange={handleChange}
            placeholder="08123"
            className="input w-full text-center text-3xl font-bold tracking-[0.3em] focus:border-amber-500"
          />
          <p className="mt-2 text-center text-xs text-gray-400">
            Contoh: nomor 08123-456-789 → masukkan <strong>08123</strong>
          </p>
        </div>

        {err && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {err}
          </p>
        )}

        <button
          disabled={loading || code.length !== 5}
          className="btn-primary btn-lg w-full disabled:opacity-50"
        >
          {loading ? "Memproses..." : "MASUK"}
        </button>

        <a
          href="/login"
          className="block text-center text-sm text-gray-400 hover:text-gray-600"
        >
          Login sebagai Mandor / Supervisor
        </a>
      </form>
    </div>
  );
}
