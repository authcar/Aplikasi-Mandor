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
      <div className="mb-8">
        <img src="/logo.png" alt="Taraco Interior" className="mb-4 h-12 w-auto" />
      </div>

      <form onSubmit={onSubmit} className="card space-y-4 p-5">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="nama@gmail.com"
            className="input text-lg"
            required
          />
        </div>
        <div>
          <label className="label">Sandi</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input text-lg"
            required
          />
        </div>
        {err && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
            {err}
          </p>
        )}
        <button disabled={loading} className="btn-primary btn-lg w-full">
          {loading ? "Memproses..." : "MASUK"}
        </button>

        <a
          href="/tukang-harian-login"
          className="block text-center text-sm text-amber-600 hover:text-amber-800 font-medium pt-1"
        >
          Login sebagai Tukang Harian →
        </a>
      </form>
    </div>
  );
}
