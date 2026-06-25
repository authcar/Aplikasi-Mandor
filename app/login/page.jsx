"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Login pakai email sederhana (phone@mandor.app) agar mandor cukup ingat no HP.
  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const email = phone.includes("@") ? phone : `${phone}@mandor.app`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setErr("Nomor HP atau sandi salah.");
    router.push("/");
  };

  return (
    <div className="flex min-h-screen flex-col justify-center p-6">
      <h1 className="mb-1 text-3xl font-bold text-brand">Aplikasi Mandor</h1>
      <p className="mb-8 text-gray-500">Masuk untuk mulai bekerja</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-lg font-medium">Nomor HP</label>
          <input
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0812xxxx"
            className="w-full rounded-xl border-2 border-gray-300 p-4 text-lg"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-lg font-medium">Sandi</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-300 p-4 text-lg"
            required
          />
        </div>
        {err && <p className="text-red-600">{err}</p>}
        <button
          disabled={loading}
          className="w-full rounded-xl bg-brand p-4 text-xl font-bold text-white disabled:opacity-60"
        >
          {loading ? "Memproses..." : "MASUK"}
        </button>
      </form>
    </div>
  );
}
