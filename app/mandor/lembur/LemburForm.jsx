"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";

const TARIF = 80000;
const rupiah = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function LemburForm({ proyek }) {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(today);
  const [hari, setHari] = useState("1");
  const [orang, setOrang] = useState("1");
  const [busy, setBusy] = useState(false);

  const totalBiaya = Number(hari) * Number(orang) * TARIF;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const uid = (await supabase.auth.getUser()).data.user.id;
    // jam = hari × orang, tarif_per_jam = 80000 → total = jam × tarif = hari × orang × 80000
    await supabase.from("lembur").insert({
      proyek_id: proyek.id,
      tanggal,
      jam: Number(hari) * Number(orang),
      tarif_per_jam: TARIF,
      catatan: `${orang} orang × ${hari} hari`,
      created_by: uid,
    });
    setBusy(false);
    router.push(`/mandor?proyek=${proyek.id}`);
  };

  if (!proyek) return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <main className="p-4">
      <BackButton href={`/mandor?proyek=${proyek.id}`} />
      <h1 className="mb-6 text-xl font-bold tracking-tight">Lembur</h1>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Tanggal</label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="input text-lg"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Jumlah Hari</label>
            <input
              inputMode="decimal"
              value={hari}
              onChange={(e) => setHari(e.target.value)}
              className="input text-lg"
              placeholder="1"
              min="0.5"
              step="0.5"
              required
            />
          </div>
          <div>
            <label className="label">Jumlah Orang</label>
            <input
              inputMode="numeric"
              value={orang}
              onChange={(e) => setOrang(e.target.value.replace(/\D/g, ""))}
              onBlur={(e) => { if (!e.target.value) setOrang("1"); }}
              className="input text-lg"
              placeholder="1"
              min="1"
              required
            />
          </div>
        </div>

        {/* Preview total */}
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
          <p className="text-xs text-indigo-500 mb-1">{orang} orang × {hari} hari × {rupiah(TARIF)}</p>
          <p className="text-2xl font-bold text-indigo-700">{rupiah(totalBiaya)}</p>
        </div>

        <button disabled={busy} className="btn-primary btn-lg w-full">
          {busy ? "Mengirim..." : "AJUKAN KE SUPERVISOR"}
        </button>
      </form>
    </main>
  );
}
