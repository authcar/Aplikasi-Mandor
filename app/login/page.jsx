"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

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
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-white shadow-brand">
          <Icon name="hard-hat" className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Aplikasi Mandor
        </h1>
        <p className="mt-1 text-gray-500">Masuk untuk mulai bekerja</p>
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
