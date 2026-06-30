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

  // Semua proyek aktif yang dipegang mandor (boleh lebih dari satu).
  const { data: proyekList } = await supabase
    .from("proyek")
    .select("id, nama, lokasi")
    .eq("mandor_id", profile.id)
    .eq("is_active", true)
    .order("nama");

  const list = proyekList || [];
  // Proyek terpilih: dari ?proyek=, jika tidak valid pakai yang pertama.
  const proyek = list.find((p) => p.id === searchParams?.proyek) || list[0] || null;

  let hadir = 0,
    upah = 0,
    pendingApr = 0;

  if (proyek) {
    const { data: abs } = await supabase
      .from("absensi")
      .select("hadir, upah_snap")
      .eq("proyek_id", proyek.id)
      .eq("tanggal", today);
    hadir = (abs || []).filter((a) => a.hadir).length;
    upah = (abs || []).reduce((s, a) => s + Number(a.upah_snap), 0);

    const [{ count: l }, { count: k }] = await Promise.all([
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
    ]);
    pendingApr = (l || 0) + (k || 0);
  }

  const q = proyek ? `?proyek=${proyek.id}` : "";
  const actions = [
    { href: `/mandor/absensi${q}`, label: "Absensi", icon: "check-circle", tile: "bg-green-100 text-green-600" },
    { href: `/mandor/lembur${q}`, label: "Lembur / Kasbon", icon: "clock", tile: "bg-indigo-100 text-indigo-600" },
    { href: `/mandor/reimburse${q}`, label: "Reimburse", icon: "receipt", tile: "bg-purple-100 text-purple-600" },
    { href: `/mandor/masalah${q}`, label: "Lapor Masalah", icon: "alert-triangle", tile: "bg-amber-100 text-amber-600" },
  ];

  return (
    <main className="p-4 pb-8">
      <header className="mb-5 flex items-center justify-between">
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

          <div className="hero mb-5">
            <p className="text-base font-semibold">{proyek.nama}</p>
            <p className="mb-4 flex items-center gap-1 text-xs text-white/70">
              <Icon name="map-pin" className="h-3.5 w-3.5" />
              {proyek.lokasi}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Stat big={`${hadir} org`} label="Hadir hari ini" />
              <Stat big={rupiah(upah)} label="Upah hari ini" />
            </div>
          </div>

          {/* Tombol cepat besar — mudah disentuh */}
          <div className="grid grid-cols-2 gap-3">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="card-tap flex flex-col items-start gap-3 p-4"
              >
                <span className={`icon-tile ${a.tile}`}>
                  <Icon name={a.icon} />
                </span>
                <span className="text-base font-semibold leading-tight">
                  {a.label}
                </span>
              </Link>
            ))}
          </div>

          <Link
            href={`/mandor/gaji${q}`}
            className="card-tap mt-3 flex items-center gap-3 p-4"
          >
            <span className="icon-tile bg-emerald-100 text-emerald-600">
              <Icon name="wallet" />
            </span>
            <span className="flex-1 text-base font-semibold">Rekap Gaji Proyek</span>
            <Icon name="chevron-right" className="h-5 w-5 text-gray-300" />
          </Link>

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
