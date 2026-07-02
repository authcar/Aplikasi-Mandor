import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";
import StreakWidget from "@/components/StreakWidget";

export const dynamic = "force-dynamic";

export default async function DashboardSupervisor() {
  const { user, profile, supabase } = await getSessionProfile();

  const jam = Number(
    new Intl.DateTimeFormat("id-ID", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date())
  );
  const sapa = jam < 11 ? "Selamat Pagi" : jam < 15 ? "Selamat Siang" : jam < 19 ? "Selamat Sore" : "Selamat Malam";

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, lokasi, icon, mandor:mandor_id(name)")
    .eq("is_active", true);

  const today = new Date();
  const bulanIni = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const chatId = String(profile.telegram_chat_id ?? "");

  const [{ count: l }, { count: k }, { count: m }, { data: potongan }, { data: checkin }] = await Promise.all([
    supabase.from("lembur").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("keuangan").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("masalah").select("id", { count: "exact", head: true }).neq("status", "DONE"),
    supabase.from("potongan_gaji").select("id, tanggal, persentase").eq("chat_id", chatId).gte("tanggal", bulanIni).order("tanggal"),
    supabase.from("checkin_harian").select("tanggal").eq("chat_id", chatId).gte("tanggal", bulanIni),
  ]);
  const pending = (l || 0) + (k || 0);
  const masalahAktif = m || 0;
  const todayStr = today.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const sudahLaporan = (checkin || []).some((c) => c.tanggal === todayStr);
  const isWeekend = today.getDay() === 0; // Minggu = libur, tidak wajib laporan

  return (
    <main className="flex h-dvh flex-col overflow-hidden p-4 gap-3">

      {/* Header */}
      <header className="flex shrink-0 items-center justify-between">
        <div>
          <p className="text-xs font-medium text-brand">Supervisor</p>
          <h1 className="text-lg font-bold tracking-tight">{sapa}, {profile.name}!</h1>
        </div>
      </header>

      {/* Notifikasi laporan harian */}
      {!sudahLaporan && !isWeekend && (
        <a
          href="https://t.me/TaracoBot"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 active:bg-amber-100"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg">📋</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-800">Laporan harian belum dibuat</p>
            <p className="text-xs text-amber-600">Ketuk untuk buka Telegram</p>
          </div>
          <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10v10M7 17 17 7" />
          </svg>
        </a>
      )}

      {/* Hero: menunggu persetujuan */}
      <Link href="/supervisor/persetujuan" className="hero shrink-0 flex items-center gap-3 py-3 px-4">
        <span className="icon-tile bg-white/15 text-white">
          <Icon name="inbox" />
        </span>
        <div className="flex-1">
          <p className="text-xs text-white/80">Menunggu Persetujuan</p>
          <p className="text-2xl font-bold leading-tight">{pending}</p>
        </div>
        <Icon name="chevron-right" className="h-5 w-5 text-white/70" />
      </Link>

      {/* Buat laporan + grid stats */}
      <div className="shrink-0 grid grid-cols-3 gap-2">
        <a
          href="https://t.me/TaracoBot"
          target="_blank"
          rel="noopener noreferrer"
          className="card-tap col-span-1 flex flex-col items-center justify-center gap-1 p-3"
        >
          <span className="icon-tile bg-sky-100 text-sky-600 !w-8 !h-8">
            <Icon name="clipboard" />
          </span>
          <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">Laporan Harian</p>
          <Icon name="arrow-up-right" className="h-3 w-3 text-gray-300" />
        </a>

        <Link href="/supervisor/masalah" className="card-tap flex flex-col items-center justify-center gap-0.5 p-3">
          <span className="icon-tile bg-red-100 text-red-600 !w-8 !h-8">
            <Icon name="alert-triangle" />
          </span>
          <p className="text-[11px] font-semibold text-gray-600">Kurang Material</p>
          <p className="text-xl font-bold text-red-500 leading-tight">{masalahAktif}</p>
        </Link>

        <Link href="/supervisor/gaji" className="card-tap flex flex-col items-center justify-center gap-0.5 p-3">
          <span className="icon-tile bg-emerald-100 text-emerald-600 !w-8 !h-8">
            <Icon name="wallet" />
          </span>
          <p className="text-[11px] font-semibold text-gray-600">Rekap Gaji</p>
          <p className="text-[11px] font-medium text-brand">Lihat ›</p>
        </Link>
      </div>

      {/* Streak widget */}
      <div className="shrink-0">
        <StreakWidget potongan={potongan || []} checkin={checkin || []} />
      </div>

      {/* Proyek — scroll bersama */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">

      {/* Proyek — card dengan scroll internal, flex-1 sisa ruang */}
      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <h2 className="font-bold text-gray-700 text-sm">Proyek Saya ({proyek?.length || 0})</h2>
          <Link
            href="/supervisor/proyek/baru"
            className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow-brand active:bg-brand-800"
          >
            + Proyek Baru
          </Link>
        </div>
        <div className="divide-y divide-gray-100 overflow-y-auto">
          {(proyek || []).map((p) => (
            <Link
              key={p.id}
              href={`/supervisor/proyek/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-gray-50"
            >
              <span className="icon-tile bg-brand-50 text-brand-600 !w-8 !h-8">
                <Icon name={p.icon || "building"} />
              </span>
              <div className="flex-1">
                <p className="font-semibold text-sm">{p.nama}</p>
                <p className="text-xs text-gray-500">{p.lokasi} · {p.mandor?.name || "-"}</p>
              </div>
              <Icon name="chevron-right" className="h-4 w-4 text-gray-300" />
            </Link>
          ))}
          {(proyek || []).length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">
              Belum ada proyek. Ketuk <span className="font-semibold">+ Proyek Baru</span>.
            </div>
          )}
        </div>
      </div>
      </div>

    </main>
  );
}
