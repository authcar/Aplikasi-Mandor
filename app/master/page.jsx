import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { syncProyekFromTaraco } from "@/lib/supabase/syncProyek";
import { rupiah } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function DashboardMaster() {
  const { profile, supabase } = await getSessionProfile();

  const jam = Number(
    new Intl.DateTimeFormat("id-ID", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date())
  );
  const sapa = jam < 11 ? "Selamat Pagi" : jam < 15 ? "Selamat Siang" : jam < 19 ? "Selamat Sore" : "Selamat Malam";

  const today = new Date();
  const bulanIni = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const chatId = String(profile.telegram_chat_id ?? "");

  // Semua proyek disinkronkan otomatis dari Taraco (satu-satunya sumber data proyek).
  await syncProyekFromTaraco();

  // Master melihat semua proyek aktif (tidak difilter supervisor_id)
  const { data: proyek } = await supabase
    .from("proyek")
    .select("id, nama, lokasi, icon, nilai_proyek, mandor:mandor_id(name)")
    .eq("is_active", true);

  const totalNilaiProyek = (proyek || []).reduce((sum, p) => sum + (p.nilai_proyek || 0), 0);

  const todayStr = today.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const proyekIds = (proyek || []).map((p) => p.id);

  const [
    { count: l },
    { count: k },
    { count: m },
    { data: potongan },
    { data: laporanHariIniRows },
    { data: absensiHariIniRows },
  ] = await Promise.all([
    supabase.from("lembur").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("keuangan").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase.from("masalah").select("id", { count: "exact", head: true }).neq("status", "DONE"),
    supabase.from("potongan_gaji").select("id, tanggal, persentase").eq("chat_id", chatId).gte("tanggal", bulanIni).order("tanggal"),
    // Proyek yang sudah ada laporan_harian hari ini — dipakai buat notifikasi
    // "belum lapor" di bawah, jadi Master gak perlu cek manual satu-satu.
    proyekIds.length
      ? supabase.from("laporan_harian").select("proyek_id").eq("tanggal", todayStr).in("proyek_id", proyekIds)
      : Promise.resolve({ data: [] }),
    // Proyek yang sudah ada absensi_tim hari ini — buat notifikasi "belum absen".
    proyekIds.length
      ? supabase.from("absensi_tim").select("proyek_id").eq("tanggal", todayStr).in("proyek_id", proyekIds)
      : Promise.resolve({ data: [] }),
  ]);

  const pending = (l || 0) + (k || 0);
  const masalahAktif = m || 0;

  const proyekSudahLaporSet = new Set((laporanHariIniRows || []).map((r) => r.proyek_id));
  const proyekSudahAbsenSet = new Set((absensiHariIniRows || []).map((r) => r.proyek_id));
  const proyekBelumLapor = (proyek || []).filter((p) => !proyekSudahLaporSet.has(p.id));
  const proyekBelumAbsen = (proyek || []).filter((p) => !proyekSudahAbsenSet.has(p.id));

  return (
    <main className="flex min-h-dvh flex-col p-4 gap-3">
      <header className="flex shrink-0 items-center justify-between">
        <div>
          <p className="text-xs font-medium text-brand">Master</p>
          <h1 className="text-lg font-bold tracking-tight">{sapa}, {profile.name}!</h1>
        </div>
      </header>

      {/* Notifikasi: proyek yang belum absen / belum lapor hari ini — nama
          proyek cuma cuplikan singkat (bukan daftar penuh) supaya tetap ringkas
          walau proyek aktifnya banyak. */}
      {proyekBelumAbsen.length > 0 && (
        <Link
          href="/master/absensi"
          className="shrink-0 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 active:bg-amber-100"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm">👷</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-amber-800">{proyekBelumAbsen.length} proyek belum absen hari ini</p>
            <p className="truncate text-[11px] text-amber-600">
              {proyekBelumAbsen.slice(0, 3).map((p) => p.nama).join(", ")}
              {proyekBelumAbsen.length > 3 ? ` +${proyekBelumAbsen.length - 3} lainnya` : ""}
            </p>
          </div>
          <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-amber-400" />
        </Link>
      )}
      {proyekBelumLapor.length > 0 && (
        <Link
          href="/master/laporan-harian"
          className="shrink-0 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 active:bg-red-100"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm">📝</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-red-800">{proyekBelumLapor.length} proyek belum buat laporan harian hari ini</p>
            <p className="truncate text-[11px] text-red-600">
              {proyekBelumLapor.slice(0, 3).map((p) => p.nama).join(", ")}
              {proyekBelumLapor.length > 3 ? ` +${proyekBelumLapor.length - 3} lainnya` : ""}
            </p>
          </div>
          <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-red-400" />
        </Link>
      )}

      <Link href="/master/persetujuan" className="hero shrink-0 flex items-center gap-3 py-3 px-4">
        <span className="icon-tile bg-white/15 text-white">
          <Icon name="inbox" />
        </span>
        <div className="flex-1">
          <p className="text-xs text-white/80">Menunggu Persetujuan</p>
          <p className="text-2xl font-bold leading-tight">{pending}</p>
        </div>
        <Icon name="chevron-right" className="h-5 w-5 text-white/70" />
      </Link>

      <div className="shrink-0 grid grid-cols-2 gap-2">
        <Link href="/master/absensi"
          className="card-tap flex flex-col items-center justify-center gap-1 p-3">
          <span className="icon-tile bg-sky-100 text-sky-600 !w-8 !h-8"><Icon name="users" /></span>
          <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">Lihat Absensi</p>
          <Icon name="chevron-right" className="h-3 w-3 text-gray-300" />
        </Link>
        <Link href="/master/progres" className="card-tap flex flex-col items-center justify-center gap-1 p-3">
          <span className="icon-tile bg-indigo-100 text-indigo-600 !w-8 !h-8"><Icon name="camera" /></span>
          <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">Progres Harian</p>
          <Icon name="chevron-right" className="h-3 w-3 text-gray-300" />
        </Link>
        <Link href="/master/laporan-harian" className="card-tap flex flex-col items-center justify-center gap-1 p-3">
          <span className="icon-tile bg-rose-100 text-rose-600 !w-8 !h-8"><Icon name="clipboard" /></span>
          <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">Laporan Harian</p>
          <Icon name="chevron-right" className="h-3 w-3 text-gray-300" />
        </Link>
        <Link href="/master/masalah" className="card-tap flex flex-col items-center justify-center gap-0.5 p-3">
          <span className="icon-tile bg-red-100 text-red-600 !w-8 !h-8"><Icon name="alert-triangle" /></span>
          <p className="text-[11px] font-semibold text-gray-600">Kurang Material</p>
          <p className="text-xl font-bold text-red-500 leading-tight">{masalahAktif}</p>
        </Link>
        <Link href="/master/gaji" className="card-tap flex flex-col items-center justify-center gap-0.5 p-3">
          <span className="icon-tile bg-emerald-100 text-emerald-600 !w-8 !h-8"><Icon name="wallet" /></span>
          <p className="text-[11px] font-semibold text-gray-600">Total Nilai Jasa</p>
          <p className="text-[10px] font-bold text-emerald-600 leading-tight text-center">
            {totalNilaiProyek > 0 ? rupiah(totalNilaiProyek) : "—"}
          </p>
        </Link>
        <Link href="/master/mandor" className="card-tap flex flex-col items-center justify-center gap-1 p-3">
          <span className="icon-tile bg-teal-100 text-teal-600 !w-8 !h-8"><Icon name="hard-hat" /></span>
          <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">Mandor</p>
          <Icon name="chevron-right" className="h-3 w-3 text-gray-300" />
        </Link>
        <Link href="/master/tukang-harian" className="card-tap flex flex-col items-center justify-center gap-1 p-3">
          <span className="icon-tile bg-cyan-100 text-cyan-600 !w-8 !h-8"><Icon name="hard-hat" /></span>
          <p className="text-[11px] font-semibold text-gray-600 text-center leading-tight">Tambah Tukang Harian</p>
          <Icon name="chevron-right" className="h-3 w-3 text-gray-300" />
        </Link>
      </div>

      <div className="card flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <h2 className="font-bold text-gray-700 text-sm">Proyek Saya ({proyek?.length || 0})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(proyek || []).map((p) => (
            <Link key={p.id} href={`/master/proyek/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
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
              Belum ada proyek dari Taraco.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
