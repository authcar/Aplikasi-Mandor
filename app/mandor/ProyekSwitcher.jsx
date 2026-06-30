"use client";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

// Pemilih proyek (dropdown) — dipakai saat mandor memegang banyak proyek.
// Native <select> dipilih agar ringan & mudah dipakai di HP spek rendah.
export default function ProyekSwitcher({ list, current }) {
  const router = useRouter();

  return (
    <div className="mb-4">
      <label className="label">Pilih Proyek ({list.length})</label>
      <div className="relative">
        <select
          value={current}
          onChange={(e) => router.push(`/mandor?proyek=${e.target.value}`)}
          className="input w-full appearance-none pr-11 text-base font-semibold"
        >
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama}
              {p.lokasi ? ` — ${p.lokasi}` : ""}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
        />
      </div>
    </div>
  );
}
