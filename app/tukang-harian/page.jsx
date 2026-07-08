import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { tglID } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";
import AbsensiSayaCard from "@/components/AbsensiSayaCard";

export const dynamic = "force-dynamic";

// ============ A. DASHBOARD TUKANG HARIAN ============
export default async function DashboardTukangHarian() {
  const { profile, supabase } = await getSessionProfile();
  const today = new Date().toISOString().slice(0, 10);

  const chatId = String(profile.telegram_chat_id ?? profile.id ?? "");
  const [{ data: proyek }, { data: checkinHari }] = await Promise.all([
    profile.proyek_id
      ? supabase
          .from("proyek")
          .select("id")
          .eq("id", profile.proyek_id)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("checkin_harian")
      .select("tanggal, checkin_at, checkout_at")
      .eq("chat_id", chatId)
      .eq("tanggal", today)
      .maybeSingle(),
  ]);

  const sudahCheckin = !!checkinHari;
  const sudahCheckout = !!checkinHari?.checkout_at;

  let pendingApr = 0,
    perbaikanBaru = 0;

  if (proyek) {
    const [{ count: l }, { count: k }, { count: pb }] = await Promise.all([
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
    pendingApr = (l || 0) + (k || 0);
    perbaikanBaru = pb || 0;
  }

  const q = proyek ? `?proyek=${proyek.id}` : "";
  const actions = [
    {
      href: `/tukang-harian/lembur${q}`,
      label: "Lembur",
      icon: "clock",
      tile: "bg-indigo-100 text-indigo-600",
    },
    {
      href: `/tukang-harian/reimburse${q}`,
      label: "Reimburse",
      icon: "receipt",
      tile: "bg-purple-100 text-purple-600",
    },
    {
      href: `/tukang-harian/masalah${q}`,
      label: "Kurang Material",
      icon: "alert-triangle",
      tile: "bg-amber-100 text-amber-600",
    },
    {
      href: `/tukang-harian/perbaikan${q}`,
      label: "Perbaikan",
      icon: "wrench",
      tile: "bg-rose-100 text-rose-600",
      badge: perbaikanBaru,
    },
    {
      href: `/tukang-harian/gaji${q}`,
      label: "Dompet Saya",
      icon: "wallet",
      tile: "bg-emerald-100 text-emerald-600",
    },
  ];

  return (
    <main className="p-4 pb-8">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="mt-0.5 text-xl font-bold capitalize">{tglID(today)}</p>
        </div>
        <LogoutButton />
      </header>

      <AbsensiSayaCard
        chatId={chatId}
        sudahCheckin={sudahCheckin}
        sudahCheckout={sudahCheckout}
        checkinAt={checkinHari?.checkin_at || null}
        checkoutAt={checkinHari?.checkout_at || null}
      />

      {!proyek ? (
        <div className="card flex items-start gap-3 border-amber-200 bg-amber-50 p-4 text-amber-800">
          <Icon name="alert-triangle" className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            Belum ada proyek aktif. Hubungi Mandor/Supervisor Anda.
          </p>
        </div>
      ) : (
        <>
          {/* Notifikasi checklist perbaikan baru dari Supervisor */}
          {perbaikanBaru > 0 && (
            <Link
              href={`/tukang-harian/perbaikan${q}`}
              className="mb-3 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 active:bg-rose-100"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Icon name="wrench" className="h-3.5 w-3.5" />
              </span>
              <p className="flex-1 min-w-0 text-xs font-bold text-rose-800">
                {perbaikanBaru} checklist perbaikan baru — ketuk untuk lihat
                detail
              </p>
            </Link>
          )}

          {/* Aksi Cepat */}
          <div className="grid grid-cols-4 gap-y-3">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="relative flex flex-col items-center gap-1 active:opacity-70"
              >
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
