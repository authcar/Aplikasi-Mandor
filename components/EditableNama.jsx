"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function EditableNama({ id, initialName }) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [nama, setNama] = useState(initialName);
  const [saving, setSaving] = useState(false);

  const simpan = async () => {
    if (!nama.trim()) return;
    setSaving(true);
    await supabase.from("profiles").update({ name: nama.trim() }).eq("id", id);
    setSaving(false);
    setEditing(false);
    router.refresh();
  };

  const batal = () => {
    setNama(initialName);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-3">
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          className="input flex-1 !py-1.5 text-sm"
          autoFocus
        />
        <button
          onClick={simpan}
          disabled={saving || !nama.trim()}
          className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white active:opacity-80 disabled:opacity-50"
        >
          {saving ? "..." : "Simpan"}
        </button>
        <button onClick={batal} className="shrink-0 text-xs font-semibold text-gray-400">
          Batal
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex w-full items-center justify-between px-4 py-3 active:bg-gray-50"
    >
      <p className="text-sm text-gray-500">Nama</p>
      <span className="flex items-center gap-2">
        <p className="text-sm font-semibold text-gray-800">{initialName}</p>
        <span className="text-xs font-semibold text-brand">Ubah</span>
      </span>
    </button>
  );
}
