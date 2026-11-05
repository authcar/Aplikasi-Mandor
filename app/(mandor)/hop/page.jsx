import Link from "next/link";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { syncProyekFromTaraco } from "@/lib/supabase/syncProyek";
import { proyekHop, STAGE_LABEL } from "@/lib/supabase/proyekHop";
import { labelDeadlineProyek } from "@/lib/format";
import AbsensiPegawaiSlot from "@/components/AbsensiPegawaiSlot";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

// RLS tabel `proyek` hanya mengenal Mandor/Supervisor/Master/Finance, jadi
// daftar proyek Head of Production dibaca lewat service role (layout /hop sudah
// memastikan role-nya).
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Dashboard Head of Production: absensi pegawai, laporan harian semua proyek
// (hanya baca), dan Project Tracker. Sengaja tidak ada menu lain.
//
// Proyek Head of Production = SEMUA proyek Taraco yang pipeline MASTER-nya di
// Kick Off Meeting atau Production, kanban PRODUCTION belum "done" (lihat
// lib/supabase/proyekHop.js) — tidak bergantung pada kecocokan nama
// supervisor/mandor seperti proyek Supervisor.
export default async function DashboardHop() {
  const { profile, supabase } = await getSessionProfile();

  await syncProyekFromTaraco();
  const stagePerProyek = await proyekHop();
  const { data: proyek } = await supabaseAdmin
    .from("proyek")
    .select("id, nama, lokasi, deadline, portal_id, supervisor:supervisor_id(name)")
    .in("id", [...stagePerProyek.keys()])
    .order("deadline", { ascending: true, nullsFirst: false });

  const jam = Number(
    new Intl.DateTimeFormat("id-ID", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date()),
  );
  const sapa = jam < 11 ? "Selamat Pagi" : jam < 15 ? "Selamat Siang" : jam < 19 ? "Selamat Sore" : "Selamat Malam";

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-4">
      <header className="flex shrink-0 items-center justify-between">
        <div>
          <p className="text-xs font-medium text-brand">Head of Production</p>
          <h1 className="text-lg font-bold tracking-tight">
            {sapa}, {profile.name}!
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/hop/profil"
            aria-label="Profil"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-card active:bg-gray-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
          <LogoutButton />
        </div>
      </header>

      <AbsensiPegawaiSlot supabase={supabase} profile={profile} />

      <div className="grid grid-cols-3 gap-3">
        <Link href="/hop/laporan-harian" className="card-tap flex flex-col items-center justify-center gap-2 p-4 active:opacity-70">
          <span className="icon-tile !rounded-full bg-sky-100 text-sky-600">
            <Icon name="clipboard" />
          </span>
          <p className="text-center text-xs font-semibold leading-tight text-gray-600">Buat Laporan Harian</p>
        </Link>
        <Link href="/hop/laporan-semua" className="card-tap flex flex-col items-center justify-center gap-2 p-4 active:opacity-70">
          <span className="icon-tile !rounded-full bg-emerald-100 text-emerald-600">
            <Icon name="check-circle" />
          </span>
          <p className="text-center text-xs font-semibold leading-tight text-gray-600">Semua Laporan</p>
        </Link>
        <Link href="/portal" className="card-tap flex flex-col items-center justify-center gap-2 p-4 active:opacity-70">
          <span className="icon-tile !rounded-full bg-amber-100 text-amber-700">
            <Icon name="share" />
          </span>
          <p className="text-center text-xs font-semibold leading-tight text-gray-600">Project Tracker</p>
        </Link>
      </div>

      {/* Proyek berjalan */}
      <div className="card flex flex-col">
        <div className="border-b border-gray-100 px-4 py-2.5">
          <h2 className="text-sm font-bold text-gray-700">Proyek Berjalan ({(proyek || []).length})</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {(proyek || []).map((p) => {
            const deadline = labelDeadlineProyek(p.deadline);
            const isi = (
              <>
                <span className="icon-tile !h-8 !w-8 bg-brand-50 text-brand-600">
                  <Icon name="building" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{p.nama}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        stagePerProyek.get(p.id) === "kickoff" ? "bg-amber-100 text-amber-700" : "bg-brand-50 text-brand-600"
                      }`}
                    >
                      {STAGE_LABEL[stagePerProyek.get(p.id)] || "Production"}
                    </span>
                  </div>
                  <p className="truncate text-xs text-gray-500">
                    {[p.lokasi, p.supervisor?.name && `SPV ${p.supervisor.name}`].filter(Boolean).join(" · ")}
                  </p>
                  {deadline && (
                    <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${deadline.cls}`}>
                      <Icon name="calendar" className="h-3 w-3" />
                      {deadline.teks}
                    </span>
                  )}
                </div>
              </>
            );
            return p.portal_id ? (
              <Link key={p.id} href={`/portal/proyek/${p.portal_id}`} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
                {isi}
                <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-gray-300" />
              </Link>
            ) : (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">{isi}</div>
            );
          })}
          {(proyek || []).length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">Belum ada proyek berjalan dari Taraco.</div>
          )}
        </div>
      </div>
    </main>
  );
}
