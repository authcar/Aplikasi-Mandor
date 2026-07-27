import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { syncProyekFromTaraco } from "@/lib/supabase/syncProyek";
import { rupiah, tglID } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";
import ProyekSwitcher from "./ProyekSwitcher";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

// ============ A. DASHBOARD MANDOR ============
export default async function DashboardMandor({ searchParams }) {
  const { profile, supabase } = await getSessionProfile();
  const today = new Date().toISOString().slice(0, 10);

  // Semua proyek disinkronkan otomatis dari Taraco (satu-satunya sumber data proyek).
  await syncProyekFromTaraco();

  const jam = Number(
    new Intl.DateTimeFormat("id-ID", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date())
  );
  const sapa = jam < 11 ? "Selamat Pagi" : jam < 15 ? "Selamat Siang" : jam < 19 ? "Selamat Sore" : "Selamat Malam";

  const { data: proyekList } = await supabase
    .from("proyek")
    .select("id, nama, lokasi, nilai_proyek, sisa_budget")
    .eq("mandor_id", profile.id)
    .eq("is_active", true)
    .order("nama");

  const list = proyekList || [];
  // Proyek terpilih: dari ?proyek=, jika tidak valid pakai yang pertama.
  const proyek = list.find((p) => p.id === searchParams?.proyek) || list[0] || null;

  let pendingApr = 0,
    perbaikanBaru = 0,
    reimburseBaru = 0,
    kasbonBaru = 0,
    masalahBaru = 0;

  if (proyek) {
    // Perbaikan sekarang ditampilkan lintas semua proyek mandor sekaligus,
    // termasuk item yang di-assign manual lewat assigned_mandor_id (lihat
    // app/mandor/perbaikan & add_checklist_assigned_mandor.sql) — badge-nya
    // ikut menghitung itu, bukan cuma proyek resmi yang lagi dipilih.
    const proyekIds = list.map((p) => p.id);
    const perbaikanOr =
      (proyekIds.length > 0 ? `proyek_id.in.(${proyekIds.join(",")}),` : "") +
      `assigned_mandor_id.eq.${profile.id}`;
    const [{ count: k }, { count: pb }, { count: rb }, { count: kb }, { count: mb }] = await Promise.all([
      supabase
        .from("keuangan")
        .select("id", { count: "exact", head: true })
        .eq("proyek_id", proyek.id)
        .eq("status", "PENDING"),
      supabase
        .from("checklist_perbaikan")
        .select("id", { count: "exact", head: true })
        .eq("dibaca_mandor", false)
        .or(perbaikanOr),
      // Hasil approve/reject reimburse milik mandor ini yang belum dilihat.
      supabase
        .from("keuangan")
        .select("id", { count: "exact", head: true })
        .eq("proyek_id", proyek.id)
        .eq("jenis", "REIMBURSE")
        .eq("created_by", profile.id)
        .eq("dibaca_pemohon", false),
      // Hasil approve/reject kasbon milik mandor ini yang belum dilihat.
      supabase
        .from("keuangan")
        .select("id", { count: "exact", head: true })
        .eq("proyek_id", proyek.id)
        .eq("jenis", "KASBON")
        .eq("created_by", profile.id)
        .eq("dibaca_pemohon", false),
      // Perubahan status laporan masalah milik mandor ini yang belum dilihat.
      supabase
        .from("masalah")
        .select("id", { count: "exact", head: true })
        .eq("proyek_id", proyek.id)
        .eq("created_by", profile.id)
        .eq("dibaca_pelapor", false),
    ]);
    pendingApr = k || 0;
    perbaikanBaru = pb || 0;
    reimburseBaru = rb || 0;
    kasbonBaru = kb || 0;
    masalahBaru = mb || 0;
  }

  const q = proyek ? `?proyek=${proyek.id}` : "";
  const actions = [
    { href: `/mandor/reimburse${q}`, label: "Reimburse", icon: "receipt", tile: "bg-purple-100 text-purple-600", badge: reimburseBaru },
    { href: `/mandor/kasbon${q}`, label: "Kasbon", icon: "wallet", tile: "bg-orange-100 text-orange-600", badge: kasbonBaru },
    { href: `/mandor/masalah${q}`, label: "Kurang Material", icon: "alert-triangle", tile: "bg-amber-100 text-amber-600", badge: masalahBaru },
    { href: "/mandor/perbaikan", label: "Perbaikan", icon: "wrench", tile: "bg-rose-100 text-rose-600", badge: perbaikanBaru },
  ];

  return (
    <main className="p-4 pb-8">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
            {profile.name?.[0]?.toUpperCase() ?? "M"}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-brand">{sapa}</p>
            <h1 className="truncate text-lg font-bold tracking-tight">{profile.name}</h1>
            <p className="text-xs capitalize text-gray-400">{tglID(today)}</p>
          </div>
        </div>
        <LogoutButton />
      </header>

      {!proyek ? (
        <div className="card flex items-start gap-3 border-amber-200 bg-amber-50 p-4 text-amber-800">
          <Icon name="alert-triangle" className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            Belum ada proyek aktif. Hubungi Supervisor Anda.
          </p>
        </div>
      ) : (
        <>
          {/* Pemilih proyek (dropdown) — tampil bila mandor memegang lebih dari satu */}
          {list.length > 1 && <ProyekSwitcher list={list} current={proyek.id} />}

          {/* Notifikasi checklist perbaikan baru dari Supervisor */}
          {perbaikanBaru > 0 && (
            <Link
              href="/mandor/perbaikan"
              className="mb-3 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 active:bg-rose-100"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Icon name="wrench" className="h-3.5 w-3.5" />
              </span>
              <p className="flex-1 min-w-0 text-xs font-bold text-rose-800">
                {perbaikanBaru} checklist perbaikan baru — ketuk untuk lihat detail
              </p>
            </Link>
          )}

          <div className="hero mb-4 p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="icon-tile !h-9 !w-9 bg-white/15 text-white">
                <Icon name="building" className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold leading-tight">{proyek.nama}</p>
                <p className="flex items-center gap-1 text-xs text-white/70">
                  <Icon name="map-pin" className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{proyek.lokasi}</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat big={proyek.nilai_proyek ? rupiah(proyek.nilai_proyek) : "—"} label="Nilai Jasa Tukang" />
              <Stat big={proyek.sisa_budget != null ? rupiah(proyek.sisa_budget) : "—"} label="Sisa Budget" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-y-4">
            {actions.map((a) => (
              <Link key={a.href} href={a.href} className="relative flex flex-col items-center gap-1.5 active:opacity-70">
                <span className={`icon-tile !rounded-full ${a.tile}`}>
                  <Icon name={a.icon} />
                </span>
                {!!a.badge && (
                  <span className="absolute right-2 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {a.badge}
                  </span>
                )}
                <span className="text-[11px] font-semibold text-gray-600 text-center leading-tight">
                  {a.label}
                </span>
              </Link>
            ))}
          </div>

          {pendingApr > 0 && (
            <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-card">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
                <Icon name="clock" className="h-3.5 w-3.5" />
              </span>
              <p className="text-xs font-semibold text-gray-600">
                {pendingApr} pengajuan menunggu persetujuan Master
              </p>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Stat({ big, label }) {
  return (
    <div className="rounded-xl bg-white/10 p-3 ring-1 ring-inset ring-white/15">
      <p className="text-lg font-bold">{big}</p>
      <p className="text-xs text-white/75">{label}</p>
    </div>
  );
}
