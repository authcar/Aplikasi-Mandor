"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

const labelProyek = (p) => p.nama + (p.lokasi ? ` — ${p.lokasi}` : "");

// Pemilih proyek dengan search — dipakai saat mandor memegang banyak proyek.
// Custom combobox (bukan native <select>) supaya daftar proyek yang panjang
// bisa difilter lewat nama/lokasi tanpa perlu scroll manual.
export default function ProyekSwitcher({ list, current }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);

  const currentProyek = list.find((p) => p.id === current);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((p) => labelProyek(p).toLowerCase().includes(query));
  }, [list, q]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const bukaDropdown = () => {
    setQ("");
    setOpen(true);
  };

  const pilih = (id) => {
    setOpen(false);
    setQ("");
    startTransition(() => router.push(`/mandor?proyek=${id}`));
  };

  return (
    <div className="mb-4" ref={wrapRef}>
      <label className="label">Pilih Proyek ({list.length})</label>
      <div className="relative">
        <button
          type="button"
          disabled={isPending}
          onClick={() => (open ? setOpen(false) : bukaDropdown())}
          className={`input flex w-full items-center justify-between gap-2 text-left text-base font-semibold transition-opacity ${
            isPending ? "opacity-50" : ""
          }`}
        >
          <span className="truncate">{currentProyek ? labelProyek(currentProyek) : "Pilih proyek"}</span>
          {isPending ? (
            <svg className="h-5 w-5 shrink-0 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <Icon
              name="chevron-down"
              className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {open && (
          <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="relative border-b border-gray-100 p-2">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
                placeholder="Cari proyek..."
                className="input !py-2 !pl-9 !text-sm"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400">Proyek tidak ditemukan.</p>
              )}
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pilih(p.id)}
                  className={`block w-full truncate px-4 py-2.5 text-left text-sm active:bg-gray-50 ${
                    p.id === current ? "bg-brand-50 font-semibold text-brand-800" : "text-gray-700"
                  }`}
                >
                  {labelProyek(p)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
