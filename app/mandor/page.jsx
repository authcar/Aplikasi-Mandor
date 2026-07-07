import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah, tglID } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";
import ProyekSwitcher from "./ProyekSwitcher";
import Icon from "@/components/Icon";
import AbsensiSayaCard from "@/components/AbsensiSayaCard";

export const dynamic = "force-dynamic";

// ============ A. DASHBOARD MANDOR ============
export default async function DashboardMandor({ searchParams }) {
  const { profile, supabase } = await getSessionProfile();
  const today = new Date().toISOString().slice(0, 10);

  // Semua proyek aktif + check-in hari ini diambil sekaligus (paralel).
  const chatId = String(profile.telegram_chat_id ?? profile.id ?? "");
  const [{ data: proyekList }, { data: checkinHari }] = await Promise.all([
    supabase
      .from("proyek")
      .select("id, nama, lokasi, nilai_proyek")
      .eq("mandor_id", profile.id)
      .eq("is_active", true)
      .order("nama"),
    supabase
      .from("checkin_harian")
      .select("tanggal, checkout_at")
      .eq("chat_id", chatId)
      .eq("tanggal", today)
      .maybeSingle(),
  ]);

  const list = proyekList || [];
  // Proyek terpilih: dari ?proyek=, jika tidak valid pakai yang pertama.
  const proyek = list.find((p) => p.id === searchParams?.proyek) || list[0] || null;

  const sudahCheckin = !!checkinHari;
  const sudahCheckout = !!checkinHari?.checkout_at;

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
    { href: `/mandor/perbaikan${q}`, label: "Checklist Perbaikan", icon: "wrench", tile: "bg-rose-100 text-rose-600", badge: perbaikanBaru },
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

      <AbsensiSayaCard chatId={chatId} sudahCheckin={sudahCheckin} sudahCheckout={sudahCheckout} />

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
              className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 active:bg-rose-100"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Icon name="wrench" className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-rose-800">
                  {perbaikanBaru} checklist perbaikan baru
                </p>
                <p className="text-xs text-rose-600">Ketuk untuk lihat detail</p>
              </div>
              <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-rose-400" />
            </Link>
          )}

          <div className="hero mb-5">
            <p className="text-base font-semibold">{proyek.nama}</p>
            <p className="mb-4 flex items-center gap-1 text-xs text-white/70">
              <Icon name="map-pin" className="h-3.5 w-3.5" />
              {proyek.lokasi}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Stat big={`${hadir} org`} label="Hadir hari ini" />
              <Stat big={proyek.nilai_proyek ? rupiah(proyek.nilai_proyek) : "—"} label="Nilai Jasa Tukang" />
            </div>
          </div>

          {/* Tombol cepat besar — mudah disentuh */}
          <div className="grid grid-cols-2 gap-3">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="card-tap relative flex flex-col items-start gap-3 p-4"
              >
                {!!a.badge && (
                  <span className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                    {a.badge}
                  </span>
                )}
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
            <span className="flex-1 text-base font-semibold">Dompet Saya</span>
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
