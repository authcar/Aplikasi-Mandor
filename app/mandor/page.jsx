import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah, tglID } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";
import ProyekSwitcher from "./ProyekSwitcher";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

// ============ A. DASHBOARD MANDOR ============
export default async function DashboardMandor({ searchParams }) {
  const { profile, supabase } = await getSessionProfile();
  const today = new Date().toISOString().slice(0, 10);

  const { data: proyekList } = await supabase
    .from("proyek")
    .select("id, nama, lokasi, nilai_proyek")
    .eq("mandor_id", profile.id)
    .eq("is_active", true)
    .order("nama");

  const list = proyekList || [];
  // Proyek terpilih: dari ?proyek=, jika tidak valid pakai yang pertama.
  const proyek = list.find((p) => p.id === searchParams?.proyek) || list[0] || null;

  let hadir = 0,
    pendingApr = 0,
    perbaikanBaru = 0;

  if (proyek) {
    const [{ data: ringkas }, { count: l }, { count: k }, { count: pb }] = await Promise.all([
      supabase
        .from("absensi_ringkas")
        .select("jumlah_hadir")
        .eq("proyek_id", proyek.id)
        .eq("tanggal", today)
        .maybeSingle(),
      supabase
        .from("lembur")
        .select("id", { count: "exact", head: true })
        .eq("proyek_id", proyek.id)
        .eq("status", "PENDING"),
      supabase
        .from("keuangan")
        .select("id", { count: "exact", head: true })
        .eq("proyek_id", proyek.id)
        .eq("status", "PENDING"),
      supabase
        .from("checklist_perbaikan")
        .select("id", { count: "exact", head: true })
        .eq("proyek_id", proyek.id)
        .eq("dibaca_mandor", false),
    ]);
    hadir = ringkas?.jumlah_hadir ?? 0;
    pendingApr = (l || 0) + (k || 0);
    perbaikanBaru = pb || 0;
  }

  const q = proyek ? `?proyek=${proyek.id}` : "";
  const actions = [
    { href: `/mandor/lembur${q}`, label: "Lembur", icon: "clock", tile: "bg-indigo-100 text-indigo-600" },
    { href: `/mandor/reimburse${q}`, label: "Reimburse", icon: "receipt", tile: "bg-purple-100 text-purple-600" },
    { href: `/mandor/masalah${q}`, label: "Kurang Material", icon: "alert-triangle", tile: "bg-amber-100 text-amber-600" },
    { href: `/mandor/perbaikan${q}`, label: "Perbaikan", icon: "wrench", tile: "bg-rose-100 text-rose-600", badge: perbaikanBaru },
  ];

  return (
    <main className="p-4 pb-8">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Halo Mandor,</p>
          <h1 className="text-xl font-bold tracking-tight">{profile.name}</h1>
          <p className="mt-0.5 text-sm capitalize text-gray-400">{tglID(today)}</p>
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
              href={`/mandor/perbaikan${q}`}
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

          <div className="hero mb-3 p-4">
            <p className="text-base font-semibold">{proyek.nama}</p>
            <p className="mb-3 flex items-center gap-1 text-xs text-white/70">
              <Icon name="map-pin" className="h-3.5 w-3.5" />
              {proyek.lokasi}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat big={`${hadir} org`} label="Hadir hari ini" />
              <Stat big={proyek.nilai_proyek ? rupiah(proyek.nilai_proyek) : "—"} label="Nilai Jasa Tukang" />
            </div>
          </div>

          {/* Aksi Cepat */}
          <div className="grid grid-cols-4 gap-y-3">
            {actions.map((a) => (
              <Link key={a.href} href={a.href} className="relative flex flex-col items-center gap-1 active:opacity-70">
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
            <p className="mt-4 text-center text-sm text-gray-500">
              {pendingApr} pengajuan menunggu persetujuan Supervisor
            </p>
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
