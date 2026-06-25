"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Satu layar untuk dua kebutuhan: Lembur (jam) atau Kasbon (nominal).
export default function LemburForm({ proyek, tukang }) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState("lembur");
  const [tukangId, setTukangId] = useState(tukang[0]?.id || "");
  const [jam, setJam] = useState("");
  const [nominal, setNominal] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const uid = (await supabase.auth.getUser()).data.user.id;
    if (tab === "lembur") {
      const t = tukang.find((x) => x.id === tukangId);
      const tarif = Math.round(Number(t.upah_harian) / 8); // tarif/jam = upah harian / 8
      await supabase.from("lembur").insert({
        proyek_id: proyek.id,
        tukang_id: tukangId,
        jam: Number(jam),
        tarif_per_jam: tarif,
        created_by: uid,
      });
    } else {
      await supabase.from("keuangan").insert({
        proyek_id: proyek.id,
        tukang_id: tukangId,
        jenis: "KASBON",
        nominal: Number(nominal),
        keterangan: "Kasbon tukang",
        created_by: uid,
      });
    }
    setBusy(false);
    router.push("/mandor");
  };

  if (!proyek) return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <main className="p-4">
      <h1 className="mb-3 text-xl font-bold">Lembur / Kasbon</h1>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-gray-200 p-1">
        {["lembur", "kasbon"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg p-2 text-base font-semibold capitalize ${
              tab === t ? "bg-white text-brand" : "text-gray-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-lg font-medium">Tukang</label>
          <select
            value={tukangId}
            onChange={(e) => setTukangId(e.target.value)}
            className="w-full rounded-xl border-2 border-gray-300 p-4 text-lg"
            required
          >
            {tukang.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nama}
              </option>
            ))}
          </select>
        </div>

        {tab === "lembur" ? (
          <div>
            <label className="mb-1 block text-lg font-medium">Jumlah Jam</label>
            <input
              inputMode="decimal"
              value={jam}
              onChange={(e) => setJam(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-300 p-4 text-lg"
              placeholder="2"
              required
            />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-lg font-medium">Nominal Kasbon (Rp)</label>
            <input
              inputMode="numeric"
              value={nominal}
              onChange={(e) => setNominal(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border-2 border-gray-300 p-4 text-lg"
              placeholder="100000"
              required
            />
          </div>
        )}

        <button
          disabled={busy}
          className="w-full rounded-xl bg-brand p-4 text-xl font-bold text-white disabled:opacity-60"
        >
          {busy ? "Mengirim..." : "AJUKAN KE SUPERVISOR"}
        </button>
      </form>
    </main>
  );
}
