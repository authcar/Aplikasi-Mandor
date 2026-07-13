// Bangunan dasar + template siap-pakai buat file loading.jsx tiap halaman.
// Semua pakai animate-pulse Tailwind, tanpa JS tambahan.

export function Bar({ w = "w-full", h = "h-4", className = "" }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${w} ${h} ${className}`} />;
}

export function Circle({ size = "h-10 w-10", className = "" }) {
  return <div className={`animate-pulse rounded-full bg-gray-200 ${size} ${className}`} />;
}

export function SkeletonCard({ lines = 2, className = "" }) {
  return (
    <div className={`card space-y-2.5 p-4 ${className}`}>
      <Bar w="w-2/5" h="h-3.5" />
      {Array.from({ length: lines }).map((_, i) => (
        <Bar key={i} w={i === lines - 1 ? "w-3/5" : "w-full"} h="h-3" />
      ))}
    </div>
  );
}

// Dashboard peran (mandor/supervisor/master/tukang-harian index): header +
// hero banner + grid ikon aksi + daftar/kartu di bawah.
export function DashboardSkeleton({ tiles = 5 }) {
  return (
    <main className="p-4 pb-8">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Circle />
          <div className="space-y-1.5">
            <Bar w="w-20" h="h-2.5" />
            <Bar w="w-32" h="h-4" />
          </div>
        </div>
        <Circle size="h-8 w-8" />
      </header>

      <div className="hero mb-4 h-24 animate-pulse !bg-gray-200 p-4" />

      <div className="grid grid-cols-4 gap-y-4">
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Circle size="h-11 w-11" />
            <Bar w="w-10" h="h-2.5" />
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={1} />
      </div>
    </main>
  );
}

// Halaman form (Lembur/Reimburse/Masalah/Absensi): tombol kembali + judul +
// beberapa field + tombol besar.
export function FormSkeleton({ fields = 4 }) {
  return (
    <main className="p-4">
      <Bar w="w-24" h="h-8" className="mb-4 !rounded-full" />
      <Bar w="w-40" h="h-6" className="mb-6" />
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Bar w="w-20" h="h-3" />
            <Bar w="w-full" h="h-11" className="!rounded-xl" />
          </div>
        ))}
        <Bar w="w-full" h="h-12" className="!rounded-xl" />
      </div>
    </main>
  );
}

// Halaman daftar (Persetujuan/Gaji/Kurang Material/Perbaikan): tombol
// kembali + judul + beberapa kartu.
export function ListSkeleton({ items = 4 }) {
  return (
    <main className="p-4 pb-8">
      <Bar w="w-24" h="h-8" className="mb-4 !rounded-full" />
      <Bar w="w-40" h="h-6" className="mb-4" />
      <div className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    </main>
  );
}

// Halaman profil/detail: tombol kembali + avatar tengah + kartu info.
export function ProfileSkeleton() {
  return (
    <main className="p-4 pb-8">
      <Bar w="w-24" h="h-8" className="mb-4 !rounded-full" />
      <div className="mb-6 flex flex-col items-center gap-3">
        <Circle size="h-20 w-20" />
        <Bar w="w-28" h="h-4" />
      </div>
      <SkeletonCard lines={3} />
    </main>
  );
}
