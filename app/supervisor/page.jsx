import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function DashboardSupervisor() {
  const { profile, supabase } = await getSessionProfile();

  // Sapaan mengikuti jam (WIB).
  const jam = Number(
    new Intl.DateTimeFormat("id-ID", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Jakarta",
    }).format(new Date())
  );
  const sapa =
    jam < 11 ? "Selamat Pagi" : jam < 15 ? "Selamat Siang" : jam < 19 ? "Selamat Sore" : "Selamat Malam";

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, lokasi, mandor:mandor_id(name)")
    .eq("supervisor_id", profile.id)
    .eq("is_active", true);

  const [{ count: l }, { count: k }, { count: m }] = await Promise.all([
    supabase.from("lembur").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("keuangan").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("masalah").select("id", { count: "exact", head: true }).neq("status", "DONE"),
  ]);
  const pending = (l || 0) + (k || 0);
  const masalahAktif = m || 0;

  return (
    <main className="p-4 pb-8">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-brand">Supervisor</p>
          <h1 className="text-xl font-bold tracking-tight">
            {sapa}, {profile.name}!
          </h1>
        </div>
        <LogoutButton />
      </header>

      {/* Kartu utama: pengajuan menunggu persetujuan */}
      <Link href="/supervisor/persetujuan" className="hero mb-4 flex items-center gap-4">
        <span className="icon-tile bg-white/15 text-white">
          <Icon name="inbox" />
        </span>
        <div className="flex-1">
          <p className="text-sm text-white/80">Menunggu Persetujuan</p>
          <p className="text-3xl font-bold leading-tight">{pending}</p>
        </div>
        <Icon name="chevron-right" className="h-6 w-6 text-white/70" />
      </Link>

      <a
        href="https://t.me/TaracoBot"
        target="_blank"
        rel="noopener noreferrer"
        className="card-tap mb-5 flex items-center gap-3 p-4"
      >
        <span className="icon-tile bg-sky-100 text-sky-600">
          <Icon name="clipboard" />
        </span>
        <span className="flex-1 text-base font-semibold">Buat Laporan Harian</span>
        <Icon name="arrow-up-right" className="h-5 w-5 text-gray-300" />
      </a>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link href="/supervisor/masalah" className="card-tap p-4">
          <span className="icon-tile mb-3 bg-red-100 text-red-600">
            <Icon name="alert-triangle" />
          </span>
          <p className="text-sm font-semibold text-gray-600">Masalah Aktif</p>
          <p className="text-2xl font-bold text-red-500">{masalahAktif}</p>
        </Link>

        <Link href="/supervisor/gaji" className="card-tap flex flex-col p-4">
          <span className="icon-tile mb-3 bg-emerald-100 text-emerald-600">
            <Icon name="wallet" />
          </span>
          <p className="text-sm font-semibold text-gray-600">Rekap Gaji</p>
          <p className="mt-auto text-sm font-medium text-brand">Lihat rincian ›</p>
        </Link>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-gray-700">Proyek Saya ({proyek?.length || 0})</h2>
        <Link
          href="/supervisor/proyek/baru"
          className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-white shadow-brand active:bg-brand-800"
        >
          + Proyek Baru
        </Link>
      </div>
      <div className="space-y-3">
        {(proyek || []).map((p) => (
          <Link
            key={p.id}
            href={`/supervisor/proyek/${p.id}`}
            className="card-tap flex items-center gap-3 p-4"
          >
            <span className="icon-tile bg-brand-50 text-brand-600">
              <Icon name="building" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">{p.nama}</p>
              <p className="text-sm text-gray-500">
                {p.lokasi} · Mandor: {p.mandor?.name || "-"}
              </p>
            </div>
            <Icon name="chevron-right" className="h-5 w-5 text-gray-300" />
          </Link>
        ))}
        {(proyek || []).length === 0 && (
          <div className="card p-6 text-center text-sm text-gray-400">
            Belum ada proyek. Ketuk <span className="font-semibold">+ Proyek Baru</span>.
          </div>
        )}
      </div>
    </main>
  );
}
