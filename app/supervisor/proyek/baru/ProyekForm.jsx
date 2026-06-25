"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";

export default function ProyekForm({ mandors }) {
  const router = useRouter();
  const supabase = createClient();
  const [nama, setNama] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [mandorId, setMandorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const uid = (await supabase.auth.getUser()).data.user.id;
    const { error } = await supabase.from("proyek").insert({
      nama,
      lokasi,
      supervisor_id: uid, // wajib = diri sendiri (sesuai RLS)
      mandor_id: mandorId || null,
    });
    setBusy(false);
    if (error) return setErr("Gagal menyimpan: " + error.message);
    router.push("/supervisor");
    router.refresh();
  };

  return (
    <main className="p-4">
      <BackButton href="/supervisor" label="BATAL" />
      <header className="mb-4">
        <h1 className="text-xl font-bold">Proyek Baru</h1>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-lg font-medium">Nama Proyek</label>
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Perumahan Griya Asri"
            className="w-full rounded-xl border-2 border-gray-300 p-4 text-lg"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-lg font-medium">Lokasi</label>
          <input
            value={lokasi}
            onChange={(e) => setLokasi(e.target.value)}
            placeholder="Blok C, Bekasi"
            className="w-full rounded-xl border-2 border-gray-300 p-4 text-lg"
          />
        </div>
        <div>
          <label className="mb-1 block text-lg font-medium">Mandor (opsional)</label>
          <select
            value={mandorId}
            onChange={(e) => setMandorId(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-300 p-4 text-lg"
          >
            <option value="">— Tetapkan nanti —</option>
            {mandors.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {err && <p className="text-red-600">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded-xl bg-brand p-4 text-xl font-bold text-white disabled:opacity-60"
        >
          {busy ? "Menyimpan..." : "SIMPAN PROYEK"}
        </button>
      </form>
    </main>
  );
}
