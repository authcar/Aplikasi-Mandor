import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { syncProyekFromTaraco } from "@/lib/supabase/syncProyek";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";
import StreakWidget from "@/components/StreakWidget";

export const dynamic = "force-dynamic";

export default async function DashboardSupervisor() {
  const { user, profile, supabase } = await getSessionProfile();

  // Semua proyek disinkronkan otomatis dari Taraco (satu-satunya sumber data proyek).
  await syncProyekFromTaraco();

  const jam = Number(
    new Intl.DateTimeFormat("id-ID", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Jakarta",
    }).format(new Date()),
  );
  const sapa =
    jam < 11
      ? "Selamat Pagi"
      : jam < 15
        ? "Selamat Siang"
        : jam < 19
          ? "Selamat Sore"
          : "Selamat Malam";

  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, lokasi, icon, mandor:mandor_id(name)")
    .eq("is_active", true);

  const today = new Date();
  const bulanIni = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const chatId = String(profile.telegram_chat_id ?? "");

  const [
    { count: l },
    { count: k },
    { count: m },
    { count: pb },
    { data: potongan },
    { data: checkin },
  ] = await Promise.all([
    supabase
      .from("lembur")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
    supabase
      .from("keuangan")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
    supabase
      .from("masalah")
      .select("id", { count: "exact", head: true })
      .neq("status", "DONE"),
    supabase
      .from("checklist_perbaikan")
      .select("id", { count: "exact", head: true })
      .neq("status", "DONE"),
    supabase
      .from("potongan_gaji")
      .select("id, tanggal, persentase")
      .eq("chat_id", chatId)
      .gte("tanggal", bulanIni)
      .order("tanggal"),
    supabase
      .from("checkin_harian")
      .select("tanggal")
      .eq("chat_id", chatId)
      .gte("tanggal", bulanIni),
  ]);
  const pending = (l || 0) + (k || 0);
  const masalahAktif = m || 0;
  const perbaikanAktif = pb || 0;
  const todayStr = today.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });
  const sudahLaporan = (checkin || []).some((c) => c.tanggal === todayStr);
  const isWeekend = today.getDay() === 0; // Minggu = libur, supervisor kerja Senin–Sabtu

  return (
    <main className="flex min-h-dvh flex-col p-4 gap-3">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between">
        <div>
          <p className="text-xs font-medium text-brand">Supervisor</p>
          <h1 className="text-lg font-bold tracking-tight">
            {sapa}, {profile.name}!
          </h1>
        </div>
      </header>

      {/* Notifikasi laporan harian */}
      {!isWeekend && (
        <a
          href="https://t.me/TaracoBot"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${
            sudahLaporan
              ? "border-emerald-200 bg-emerald-50 active:bg-emerald-100"
              : "border-amber-200 bg-amber-50 active:bg-amber-100"
          }`}
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${sudahLaporan ? "bg-emerald-100" : "bg-amber-100"}`}
          >
            {sudahLaporan ? "✅" : "📋"}
          </span>
          <p
            className={`flex-1 min-w-0 text-xs font-bold ${sudahLaporan ? "text-emerald-700" : "text-amber-800"}`}
          >
            {sudahLaporan
              ? "Laporan hari ini sudah dikirim"
              : "Laporan harian belum dibuat — ketuk untuk buka Telegram"}
          </p>
        </a>
      )}

      {/* Hero: menunggu persetujuan */}
      <Link
        href="/supervisor/persetujuan"
        className="hero shrink-0 flex items-center gap-3 py-3 px-4"
      >
        <span className="icon-tile bg-white/15 text-white">
          <Icon name="inbox" />
        </span>
        <div className="flex-1">
          <p className="text-xs text-white/80">Menunggu Persetujuan</p>
          <p className="text-2xl font-bold leading-tight">{pending}</p>
        </div>
        <Icon name="chevron-right" className="h-5 w-5 text-white/70" />
      </Link>

      {/* Aksi Cepat */}
      <div className="shrink-0">
        <div className="grid grid-cols-4 gap-y-3">
          <a
            href="https://t.me/TaracoBot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 active:opacity-70"
          >
            <span className="icon-tile !rounded-full bg-sky-100 text-sky-600">
              <Icon name="clipboard" />
            </span>
            <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">
              Laporan Harian
            </p>
          </a>

          <Link
            href="/supervisor/absensi"
            className="flex flex-col items-center gap-1 active:opacity-70"
          >
            <span className="icon-tile !rounded-full bg-green-100 text-green-600">
              <Icon name="users" />
            </span>
            <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">
              Absensi Tukang
            </p>
          </Link>

          <Link
            href="/supervisor/masalah"
            className="relative flex flex-col items-center gap-1 active:opacity-70"
          >
            <span className="icon-tile !rounded-full bg-red-100 text-red-600">
              <Icon name="alert-triangle" />
            </span>
            {masalahAktif > 0 && (
              <span className="absolute right-2 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {masalahAktif}
              </span>
            )}
            <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">
              Kurang Material
            </p>
          </Link>

          <Link
            href="/supervisor/gaji"
            className="flex flex-col items-center gap-1 active:opacity-70"
          >
            <span className="icon-tile !rounded-full bg-emerald-100 text-emerald-600">
              <Icon name="wallet" />
            </span>
            <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">
              Rekap Gaji
            </p>
          </Link>

          <Link
            href="/supervisor/perbaikan"
            className="relative flex flex-col items-center gap-1 active:opacity-70"
          >
            <span className="icon-tile !rounded-full bg-indigo-100 text-indigo-600">
              <Icon name="wrench" />
            </span>
            {perbaikanAktif > 0 && (
              <span className="absolute right-2 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {perbaikanAktif}
              </span>
            )}
            <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">
              Checklist Perbaikan
            </p>
          </Link>

          <Link
            href="/supervisor/tukang-harian"
            className="flex flex-col items-center gap-1 active:opacity-70"
          >
            <span className="icon-tile !rounded-full bg-cyan-100 text-cyan-600">
              <Icon name="hard-hat" />
            </span>
            <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">
              Tambah Tukang Harian
            </p>
          </Link>

          <Link
            href="/supervisor/mandor"
            className="flex flex-col items-center gap-1 active:opacity-70"
          >
            <span className="icon-tile !rounded-full bg-teal-100 text-teal-600">
              <Icon name="hard-hat" />
            </span>
            <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">
              Mandor
            </p>
          </Link>
        </div>
      </div>

      {/* Streak widget */}
      <div className="shrink-0">
        <StreakWidget potongan={potongan || []} checkin={checkin || []} />
      </div>

      {/* Proyek */}
      <div className="card flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <h2 className="font-bold text-gray-700 text-sm">
            Proyek Saya ({proyek?.length || 0})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
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
                <p className="text-xs text-gray-500">
                  {p.lokasi} · {p.mandor?.name || "-"}
                </p>
              </div>
              <Icon name="chevron-right" className="h-4 w-4 text-gray-300" />
            </Link>
          ))}
          {(proyek || []).length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">
              Belum ada proyek dari Taraco.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
