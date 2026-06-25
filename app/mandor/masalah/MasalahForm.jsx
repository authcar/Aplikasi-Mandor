"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MasalahForm({ proyek }) {
  const router = useRouter();
  const supabase = createClient();
  const [judul, setJudul] = useState("");
  const [desk, setDesk] = useState("");
  const [foto, setFoto] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const uid = (await supabase.auth.getUser()).data.user.id;
    let foto_url = null;
    if (foto) {
      const ext = foto.name.split(".").pop();
      const path = `${proyek.id}/${Date.now()}.${ext}`;
      await supabase.storage.from("masalah").upload(path, foto);
      foto_url = path;
    }
    await supabase.from("masalah").insert({
      proyek_id: proyek.id,
      judul,
      deskripsi: desk,
      foto_url,
      created_by: uid,
    });
    setBusy(false);
    router.push("/mandor");
  };

  if (!proyek) return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <main className="p-4">
      <h1 className="mb-1 text-xl font-bold">Lapor Masalah</h1>
      <p className="mb-4 text-sm text-gray-500">{proyek.nama}</p>
      <form onSubmit={submit} className="space-y-4">
        <input
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          placeholder="Contoh: Semen kurang 10 sak"
          className="w-full rounded-xl border-2 border-gray-300 p-4 text-lg"
          required
        />
        <textarea
          value={desk}
          onChange={(e) => setDesk(e.target.value)}
          placeholder="Penjelasan tambahan (opsional)"
          rows={3}
          className="w-full rounded-xl border-2 border-gray-300 p-4 text-lg"
        />
        <label className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-5 text-gray-500">
          📷 {foto ? foto.name : "Foto material kurang / alat rusak"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setFoto(e.target.files?.[0] || null)}
          />
        </label>
        <button
          disabled={busy}
          className="w-full rounded-xl bg-brand p-4 text-xl font-bold text-white disabled:opacity-60"
        >
          {busy ? "Mengirim..." : "KIRIM LAPORAN"}
        </button>
      </form>
    </main>
  );
}
