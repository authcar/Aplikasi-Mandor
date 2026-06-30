"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BackButton from "@/components/BackButton";
import Icon from "@/components/Icon";

export default function RollCall({ proyek, tukang, hadirAwal }) {
  const router = useRouter();
  const supabase = createClient();
  const [hadir, setHadir] = useState(new Set(hadirAwal));
  const [saving, setSaving] = useState(false);
  const [foto, setFoto] = useState(null);
  const [ok, setOk] = useState(false);

  const toggle = (id) =>
    setHadir((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const semua = () => setHadir(new Set(tukang.map((t) => t.id)));

  const simpan = async () => {
    setSaving(true);
    // 1) Bulk insert absensi
    await fetch("/api/absensi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proyek_id: proyek.id, hadir_ids: [...hadir] }),
    });
    // 2) Upload foto progres (opsional) langsung ke storage
    if (foto) {
      const ext = foto.name.split(".").pop();
      const path = `${proyek.id}/${Date.now()}.${ext}`;
      await supabase.storage.from("progres").upload(path, foto);
      await supabase.from("progres_foto").insert({
        proyek_id: proyek.id,
        foto_url: path,
        created_by: (await supabase.auth.getUser()).data.user.id,
      });
    }
    setSaving(false);
    setOk(true);
    setTimeout(() => router.push(`/mandor?proyek=${proyek.id}`), 800);
  };

  if (!proyek)
    return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <main className="p-4 pb-28">
      <BackButton href={`/mandor?proyek=${proyek.id}`} />
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">Absensi Hari Ini</h1>
        <p className="text-sm text-gray-500">{proyek.nama}</p>
      </header>

      <div className="mb-3 flex items-center justify-between">
        <p className="badge bg-green-100 text-green-700">{hadir.size} hadir</p>
        <button onClick={semua} className="text-sm font-semibold text-brand">
          Centang semua
        </button>
      </div>

      {/* Daftar tukang — baris besar, sekali tap */}
      <div className="space-y-2">
        {tukang.map((t) => {
          const on = hadir.has(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                on
                  ? "border-green-500 bg-green-50 shadow-card"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div>
                <p className="text-lg font-semibold">{t.nama}</p>
                <p className="text-sm text-gray-500">{t.jabatan}</p>
              </div>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-white transition ${
                  on ? "bg-green-500" : "bg-gray-200 text-gray-400"
                }`}
              >
                <Icon name="check" className="h-5 w-5" strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Foto borongan suasana proyek */}
      <label className="mt-4 flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-300 bg-white p-5 text-sm font-medium text-gray-500 active:bg-gray-50">
        <Icon name="camera" className="h-7 w-7 text-gray-400" />
        {foto ? foto.name : "Ambil foto suasana proyek (opsional)"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setFoto(e.target.files?.[0] || null)}
        />
      </label>

      {/* Tombol simpan menempel di bawah */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-gray-200 bg-white/95 p-3 backdrop-blur">
        <button
          onClick={simpan}
          disabled={saving}
          className={`btn-lg w-full ${ok ? "btn-success" : "btn-primary"}`}
        >
          {ok ? "✓ Tersimpan" : saving ? "Menyimpan..." : "SIMPAN ABSEN"}
        </button>
      </div>
    </main>
  );
}
