import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { syncProyekFromTaraco } from "@/lib/supabase/syncProyek";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";
import StreakWidget from "@/components/StreakWidget";
import ProyekSayaCard from "@/components/ProyekSayaCard";
import LockedTile from "@/components/LockedTile";

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
  const proyekIds = (proyek || []).map((p) => p.id);

  // Rollout bertahap: cuma "Defect List" (checklist_perbaikan, antar Mandor &
  // Supervisor) yang aktif untuk sekarang — lihat LockedTile di JSX bawah.
  // Query lain yang cuma dipakai buat badge fitur yang di-lock sengaja
  // dihapus dari sini biar tidak query data yang tidak ditampilkan.
  const [
    { count: pb },
    { data: potongan },
    { data: checkin },
    { data: laporanBulanIni },
  ] = await Promise.all([
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
  const perbaikanAktif = pb || 0;
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

      {/* Hero: menunggu persetujuan — di-lock selama rollout bertahap */}
      <div
        className="shrink-0 flex items-center gap-3 rounded-2xl bg-gray-100 py-3 px-4 opacity-70"
        aria-disabled="true"
        title="Belum tersedia"
      >
        <span className="icon-tile bg-gray-200 text-gray-400">
          <Icon name="lock" />
        </span>
        <div className="flex-1">
          <p className="text-xs text-gray-400">Menunggu Persetujuan</p>
          <p className="text-sm font-semibold text-gray-400">Belum tersedia</p>
        </div>
      </div>

      {/* Aksi Cepat — cuma Defect List yang aktif selama rollout bertahap */}
      <div className="shrink-0">
        <div className="grid grid-cols-4 gap-y-3">
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

          <LockedTile label="Laporan Harian" gap="gap-1" />
          <LockedTile label="Absensi Tukang" gap="gap-1" />
          <LockedTile label="Kurang Material" gap="gap-1" />
          <LockedTile label="Rekap Gaji" gap="gap-1" />
          <LockedTile label="Kasbon" gap="gap-1" />
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
