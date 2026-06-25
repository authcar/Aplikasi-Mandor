import Link from "next/link";
import { getSessionProfile } from "@/lib/supabase/server";
import { rupiah, tglID } from "@/lib/format";
import LogoutButton from "@/components/LogoutButton";

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
    { href: `/mandor/absensi${q}`, label: "Absensi", icon: "✅" },
    { href: `/mandor/lembur${q}`, label: "Lembur / Kasbon", icon: "🕒" },
    { href: `/mandor/reimburse${q}`, label: "Reimburse", icon: "🧾" },
    { href: `/mandor/masalah${q}`, label: "Lapor Masalah", icon: "⚠️" },
  ];

  return (
    <main className="p-4 pb-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Halo Mandor,</p>
          <h1 className="text-xl font-bold">{profile.name}</h1>
        </div>
        <LogoutButton />
      </header>

      <p className="mb-4 text-sm text-gray-500">{tglID(today)}</p>

      {!proyek ? (
        <div className="rounded-xl bg-yellow-100 p-4 text-yellow-800">
          Belum ada proyek aktif. Hubungi Supervisor Anda.
        </div>
      ) : (
        <>
          {/* Pemilih proyek — tampil bila mandor memegang lebih dari satu */}
          {list.length > 1 && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-gray-600">
                Pilih Proyek ({list.length})
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {list.map((p) => {
                  const aktif = p.id === proyek.id;
                  return (
                    <Link
                      key={p.id}
                      href={`/mandor?proyek=${p.id}`}
                      className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold ${
                        aktif
                          ? "border-brand bg-brand text-white"
                          : "border-gray-300 bg-white text-gray-600"
                      }`}
                    >
                      {p.nama}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-5 rounded-2xl bg-brand p-5 text-white">
            <p className="text-sm opacity-90">{proyek.nama}</p>
            <p className="mb-3 text-xs opacity-75">{proyek.lokasi}</p>
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
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-gray-200 bg-white p-5 active:bg-gray-100"
              >
                <span className="text-3xl">{a.icon}</span>
                <span className="mt-2 text-center text-base font-semibold">
                  {a.label}
                </span>
              </Link>
            ))}
          </div>

          <Link
            href={`/mandor/gaji${q}`}
            className="mt-3 flex items-center justify-between rounded-2xl border-2 border-gray-200 bg-white p-5 active:bg-gray-100"
          >
            <span className="text-base font-semibold">💰 Rekap Gaji Proyek</span>
            <span className="text-gray-400">›</span>
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
    <div className="rounded-xl bg-white/15 p-3">
      <p className="text-lg font-bold">{big}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}
