import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { syncProyekFromTaraco } from "@/lib/supabase/syncProyek";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";
import StreakWidget from "@/components/StreakWidget";
import ProyekSayaCard from "@/components/ProyekSayaCard";

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
    .select("id, nama, lokasi, icon, deadline, mandor:mandor_id(name)")
    .eq("is_active", true)
    .order("deadline", { ascending: true, nullsFirst: false });

  const today = new Date();
  const bulanIni = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const chatId = String(profile.telegram_chat_id ?? "");
  const todayStr = today.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });
  const proyekIds = (proyek || []).map((p) => p.id);

  const [
    { count: l },
    { count: k },
    { count: m },
    { count: pb },
    { count: kb },
    { count: pgb },
    { data: potongan },
    { data: checkin },
    { data: laporanHariIni },
    { data: laporanBulanIni },
  ] = await Promise.all([
    supabase
      .from("lembur")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
    // Kasbon & Reimburse cuma disetujui Master, jadi tidak dihitung di sini.
    supabase
      .from("keuangan")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING")
      .neq("jenis", "KASBON")
      .neq("jenis", "REIMBURSE"),
    supabase
      .from("masalah")
      .select("id", { count: "exact", head: true })
      .neq("status", "DONE"),
    // Cuma bukti pengerjaan Mandor yang benar-benar menunggu keputusan
    // Supervisor (Disetujui/Tidak Disetujui) — konsisten dengan badge yang
    // sama di app/master/page.jsx. Sebelumnya .neq("status", "DONE") ikut
    // menghitung item CANCELLED (sudah dibatalkan, tidak perlu ditindak) dan
    // OPEN (masih tugas Mandor), bikin badge nempel angka besar padahal
    // tidak ada yang perlu direspons Supervisor.
    supabase
      .from("checklist_perbaikan")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_REVIEW"),
    // Hasil approve/reject kasbon milik SPV ini yang belum dilihat.
    supabase
      .from("keuangan")
      .select("id", { count: "exact", head: true })
      .eq("jenis", "KASBON")
      .eq("created_by", profile.id)
      .eq("dibaca_pemohon", false),
    // Potongan gaji baru (bot Telegram/n8n) yang belum dilihat Supervisor.
    chatId
      ? supabase
          .from("potongan_gaji")
          .select("id", { count: "exact", head: true })
          .eq("chat_id", chatId)
          .eq("dibaca_supervisor", false)
      : Promise.resolve({ count: 0 }),
    // Potongan gaji: masih dari sistem lama (Telegram/n8n), belum sinkron
    // dengan laporan harian manual di web app — lihat catatan di
    // supabase/add_laporan_harian.sql.
    supabase
      .from("potongan_gaji")
      .select("id, tanggal, persentase")
      .eq("chat_id", chatId)
      .gte("tanggal", bulanIni)
      .order("tanggal"),
    // checkin_harian: sumber lama untuk "rajin lapor" (diisi bot Telegram).
    // Tetap diambil & dikirim ke StreakWidget sebagai fallback, tidak dipakai
    // lagi untuk perhitungan utama sekarang laporan_harian sudah ada.
    supabase
      .from("checkin_harian")
      .select("tanggal")
      .eq("chat_id", chatId)
      .gte("tanggal", bulanIni),
    proyekIds.length
      ? supabase.from("laporan_harian").select("proyek_id").eq("tanggal", todayStr).in("proyek_id", proyekIds)
      : Promise.resolve({ data: [] }),
    // Laporan harian bulan berjalan utk semua proyek aktif supervisor ini —
    // sumber utama "rajin lapor" & "sudah lapor" di StreakWidget. Per proyek
    // (bukan cuma created_by) supaya satu hari baru dianggap "lapor" kalau
    // SEMUA proyeknya sudah dilaporkan, bukan cukup salah satu.
    proyekIds.length
      ? supabase
          .from("laporan_harian")
          .select("proyek_id, tanggal")
          .in("proyek_id", proyekIds)
          .gte("tanggal", bulanIni)
      : Promise.resolve({ data: [] }),
  ]);
  const pending = (l || 0) + (k || 0);
  const masalahAktif = m || 0;
  const perbaikanAktif = pb || 0;
  const kasbonBaru = kb || 0;
  const potonganBaru = pgb || 0;
  const proyekSudahLapor = new Set((laporanHariIni || []).map((r) => r.proyek_id)).size;
  const totalProyekAktif = proyekIds.length;

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

      {/* Notifikasi kelengkapan laporan harian per proyek */}
      {totalProyekAktif > 0 && proyekSudahLapor < totalProyekAktif && (
        <Link
          href="/supervisor/laporan-harian"
          className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 active:bg-amber-100"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm">
            📝
          </span>
          <p className="flex-1 min-w-0 text-xs font-bold text-amber-800">
            Anda Belum Selesai membuat laporan harian! ({proyekSudahLapor}/{totalProyekAktif} laporan harian dibuat)
          </p>
        </Link>
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
          <Link
            href="/supervisor/laporan-harian"
            className="flex flex-col items-center gap-1 active:opacity-70"
          >
            <span className="icon-tile !rounded-full bg-sky-100 text-sky-600">
              <Icon name="clipboard" />
            </span>
            <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">
              Laporan Harian
            </p>
          </Link>

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
            className="relative flex flex-col items-center gap-1 active:opacity-70"
          >
            <span className="icon-tile !rounded-full bg-emerald-100 text-emerald-600">
              <Icon name="wallet" />
            </span>
            {potonganBaru > 0 && (
              <span className="absolute right-2 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {potonganBaru}
              </span>
            )}
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
              Defect List
            </p>
          </Link>

          <Link
            href="/supervisor/kasbon"
            className="relative flex flex-col items-center gap-1 active:opacity-70"
          >
            <span className="icon-tile !rounded-full bg-orange-100 text-orange-600">
              <Icon name="wallet" />
            </span>
            {kasbonBaru > 0 && (
              <span className="absolute right-2 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {kasbonBaru}
              </span>
            )}
            <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">
              Kasbon
            </p>
          </Link>
        </div>
      </div>

      {/* Streak widget */}
      <div className="shrink-0">
        <StreakWidget
          potongan={potongan || []}
          checkin={checkin || []}
          laporanHarian={laporanBulanIni || []}
          totalProyek={totalProyekAktif}
        />
      </div>

      {/* Proyek */}
      <ProyekSayaCard proyek={proyek || []} basePath="/supervisor/proyek" />
    </main>
  );
}
