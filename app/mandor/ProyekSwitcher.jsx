"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

// Pemilih proyek (dropdown) — dipakai saat mandor memegang banyak proyek.
// Native <select> dipilih agar ringan & mudah dipakai di HP spek rendah.
export default function ProyekSwitcher({ list, current }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mb-4">
      <label className="label">Pilih Proyek ({list.length})</label>
      <div className="relative">
        <select
          value={current}
          disabled={isPending}
          onChange={(e) =>
            startTransition(() => router.push(`/mandor?proyek=${e.target.value}`))
          }
          className={`input w-full appearance-none pr-11 text-base font-semibold transition-opacity ${
            isPending ? "opacity-50" : ""
          }`}
        >
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama}
              {p.lokasi ? ` — ${p.lokasi}` : ""}
            </option>
          ))}
        </select>
        {isPending ? (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
            <svg className="h-5 w-5 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </span>
        ) : (
          <Icon
            name="chevron-down"
            className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          />
        )}
      </div>
    </div>
  );
}
