"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";

const ICON_OPTIONS = [
  { key: "building", label: "Bangunan" },
  { key: "house",    label: "Rumah" },
  { key: "bed",      label: "Kamar" },
  { key: "utensils", label: "Restoran" },
];

export default function ProyekForm({ mandors }) {
  const router = useRouter();
  const supabase = createClient();
  const [nama, setNama] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [mandorId, setMandorId] = useState("");
  const [icon, setIcon] = useState("building");
  const [nilaiProyek, setNilaiProyek] = useState("");
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
      icon,
      supervisor_id: uid,
      mandor_id: mandorId || null,
      nilai_proyek: nilaiProyek ? Number(nilaiProyek) : null,
    });
    setBusy(false);
    if (error) return setErr("Gagal menyimpan: " + error.message);
    router.push("/master");
    router.refresh();
  };

  return (
    <main className="p-4">
      <BackButton href="/master" label="BATAL" />
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">Proyek Baru</h1>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Ikon Proyek</label>
          <div className="grid grid-cols-4 gap-2">
            {ICON_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setIcon(opt.key)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 transition-colors ${
                  icon === opt.key
                    ? "border-brand bg-brand-50 text-brand"
                    : "border-gray-200 bg-white text-gray-400"
                }`}
              >
                <Icon name={opt.key} className="h-6 w-6" />
                <span className="text-[11px] font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Nama Proyek</label>
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Perumahan Griya Asri"
            className="input text-lg"
            required
          />
        </div>
        <div>
          <label className="label">Lokasi</label>
          <input
            value={lokasi}
            onChange={(e) => setLokasi(e.target.value)}
            placeholder="Blok C, Bekasi"
            className="input text-lg"
          />
        </div>
        <div>
          <label className="label">Nilai Jasa Tukang (opsional)</label>
          <input
            inputMode="numeric"
            value={nilaiProyek}
            onChange={(e) => setNilaiProyek(e.target.value.replace(/\D/g, ""))}
            placeholder="Contoh: 500000000"
            className="input text-lg"
          />
        </div>
        <div>
          <label className="label">Mandor (opsional)</label>
          <select
            value={mandorId}
            onChange={(e) => setMandorId(e.target.value)}
            className="input text-lg"
          >
            <option value="">— Tetapkan nanti —</option>
            {mandors.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {err && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{err}</p>
        )}
        <button disabled={busy} className="btn-primary btn-lg w-full">
          {busy ? "Menyimpan..." : "SIMPAN PROYEK"}
        </button>
      </form>
    </main>
  );
}
