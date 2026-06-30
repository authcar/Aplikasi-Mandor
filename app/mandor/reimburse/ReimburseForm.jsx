"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";

export default function ReimburseForm({ proyek }) {
  const router = useRouter();
  const [nominal, setNominal] = useState("");
  const [ket, setKet] = useState("");
  const [nota, setNota] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData();
    fd.append("proyek_id", proyek.id);
    fd.append("jenis", "REIMBURSE");
    fd.append("nominal", nominal);
    fd.append("keterangan", ket);
    if (nota) fd.append("nota", nota);
    const res = await fetch("/api/keuangan", { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) router.push(`/mandor?proyek=${proyek.id}`);
    else alert("Gagal mengirim. Coba lagi.");
  };

  if (!proyek) return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <main className="p-4">
      <BackButton href={`/mandor?proyek=${proyek.id}`} />
      <h1 className="text-xl font-bold tracking-tight">Reimburse / Klaim</h1>
      <p className="mb-4 text-sm text-gray-500">{proyek.nama}</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nominal (Rp)">
          <input
            inputMode="numeric"
            value={nominal}
            onChange={(e) => setNominal(e.target.value.replace(/\D/g, ""))}
            className="input text-lg"
            placeholder="50000"
            required
          />
        </Field>
        <Field label="Untuk apa?">
          <input
            value={ket}
            onChange={(e) => setKet(e.target.value)}
            className="input text-lg"
            placeholder="Uang makan tim"
            required
          />
        </Field>
        <label className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-300 bg-white p-5 text-sm font-medium text-gray-500 active:bg-gray-50">
          <Icon name="camera" className="h-7 w-7 text-gray-400" />
          {nota ? nota.name : "Foto nota / kuitansi"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setNota(e.target.files?.[0] || null)}
          />
        </label>
        <button disabled={busy} className="btn-primary btn-lg w-full">
          {busy ? "Mengirim..." : "KIRIM KE SUPERVISOR"}
        </button>
      </form>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
