"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";

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
    router.push(`/mandor?proyek=${proyek.id}`);
  };

  if (!proyek) return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <main className="p-4">
      <BackButton href={`/mandor?proyek=${proyek.id}`} />
      <h1 className="text-xl font-bold tracking-tight">Lapor Masalah</h1>
      <p className="mb-4 text-sm text-gray-500">{proyek.nama}</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Judul Masalah</label>
          <input
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="Contoh: Semen kurang 10 sak"
            className="input text-lg"
            required
          />
        </div>
        <div>
          <label className="label">Penjelasan (opsional)</label>
          <textarea
            value={desk}
            onChange={(e) => setDesk(e.target.value)}
            placeholder="Penjelasan tambahan"
            rows={3}
            className="input text-lg"
          />
        </div>
        <label className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-300 bg-white p-5 text-sm font-medium text-gray-500 active:bg-gray-50">
          <Icon name="camera" className="h-7 w-7 text-gray-400" />
          {foto ? foto.name : "Foto material kurang / alat rusak"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setFoto(e.target.files?.[0] || null)}
          />
        </label>
        <button disabled={busy} className="btn-primary btn-lg w-full">
          {busy ? "Mengirim..." : "KIRIM LAPORAN"}
        </button>
      </form>
    </main>
  );
}
