import Link from "next/link";

// Tombol kembali besar & mudah terlihat. Dipakai di seluruh halaman.
export default function BackButton({ href = "/", label = "KEMBALI" }) {
  return (
    <Link
      href={href}
      className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-300 bg-white p-4 text-lg font-bold text-gray-700 active:bg-gray-100"
    >
      <span className="text-2xl leading-none">‹</span>
      {label}
    </Link>
  );
}
