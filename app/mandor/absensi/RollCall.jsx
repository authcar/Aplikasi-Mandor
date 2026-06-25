"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    setTimeout(() => router.push("/mandor"), 800);
  };

  if (!proyek)
    return <p className="p-6">Belum ada proyek aktif.</p>;

  return (
    <main className="p-4 pb-28">
      <header className="mb-3">
        <h1 className="text-xl font-bold">Absensi Hari Ini</h1>
        <p className="text-sm text-gray-500">{proyek.nama}</p>
      </header>

      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold text-brand">{hadir.size} hadir</p>
        <button onClick={semua} className="text-sm font-medium text-brand underline">
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
              className={`flex w-full items-center justify-between rounded-xl border-2 p-4 text-left ${
                on ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"
              }`}
            >
              <div>
                <p className="text-lg font-semibold">{t.nama}</p>
                <p className="text-sm text-gray-500">{t.jabatan}</p>
              </div>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${
                  on ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>

      {/* Foto borongan suasana proyek */}
      <label className="mt-4 flex flex-col items-center rounded-xl border-2 border-dashed border-gray-300 bg-white p-5 text-gray-500">
        📷 {foto ? foto.name : "Ambil foto suasana proyek (opsional)"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setFoto(e.target.files?.[0] || null)}
        />
      </label>

      {/* Tombol simpan menempel di bawah */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t bg-white p-3">
        <button
          onClick={simpan}
          disabled={saving}
          className="w-full rounded-xl bg-brand p-4 text-xl font-bold text-white disabled:opacity-60"
        >
          {ok ? "✓ Tersimpan" : saving ? "Menyimpan..." : "SIMPAN ABSEN"}
        </button>
      </div>
    </main>
  );
}
