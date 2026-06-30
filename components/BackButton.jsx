import Link from "next/link";

// Tombol kembali besar & mudah terlihat. Dipakai di seluruh halaman.
export default function BackButton({ href = "/", label = "KEMBALI" }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-card transition active:bg-gray-100"
    >
      <span className="text-lg leading-none">‹</span>
      {label}
    </Link>
  );
}
