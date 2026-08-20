import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push";
import {
  BATAS_JAWAB_SPOTCHECK_MENIT,
  JEDA_ANTAR_SPOTCHECK_MENIT,
  MAKS_SPOTCHECK_PER_KUNJUNGAN,
  PELUANG_SPOTCHECK,
  USIA_MIN_SPOTCHECK_MENIT,
} from "@/lib/kunjunganAturan";

// POST /api/kunjungan/spot-check — dipanggil n8n tiap 5 menit.
//
// Menambal lubang heartbeat. Heartbeat cuma hidup selama aplikasi terbuka:
// browser HP tidak bisa membaca GPS di background, jadi layar terkunci =
// tidak ada data. Ketiadaan heartbeat karenanya tidak pernah dihukum — terlalu
// banyak sebab yang jujur.
//
// Yang boleh dihukum adalah permintaan eksplisit yang diabaikan. Di sini
// server memilih waktu ACAK selama kunjungan berjalan, mengirim web push, dan
// supervisor punya BATAS_JAWAB_SPOTCHECK_MENIT untuk membuka aplikasi.
// Waktunya sengaja tidak bisa ditebak: kalau ceknya selalu di menit ke-30,
// yang diukur bukan lagi kehadiran melainkan kemampuan menebak jadwal.
//
// Autentikasi: header x-n8n-secret, pola sama dengan
// app/api/kunjungan/tutup-otomatis.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const MENIT = 60000;

export async function POST(req) {
  const secret = req.headers.get("x-n8n-secret");
  if (!secret || secret !== process.env.N8N_CALLBACK_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sekarang = new Date();

  // ---- 1) Tutup spot-check yang batas waktunya sudah lewat.
  // Dijalankan tiap putaran, bukan cuma saat absen keluar: kunjungan bisa
  // berlangsung berjam-jam, dan rekapnya tidak boleh menyimpan baris
  // menggantung selama itu.
  const { data: kedaluwarsa } = await supabaseAdmin
    .from("kunjungan_pantau")
    .update({ hasil: "TIDAK_DIJAWAB" })
    .eq("jenis", "SPOTCHECK")
    .is("hasil", null)
    .lt("batas_at", sekarang.toISOString())
    .select("id");

  // ---- 2) Kandidat: semua kunjungan yang sedang berjalan.
  const { data: berjalan, error } = await supabaseAdmin
    .from("kunjungan_supervisor")
    .select("id, mulai_at, profile_id, proyek:proyek_id(nama)")
    .eq("status", "BERJALAN");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!berjalan?.length)
    return NextResponse.json({
      ok: true,
      berjalan: 0,
      dikirim: 0,
      kedaluwarsa: kedaluwarsa?.length || 0,
    });

  // Riwayat spot-check semua kandidat diambil sekali, bukan per kunjungan —
  // jumlah kunjungan berjalan kecil, tapi endpoint ini jalan tiap 5 menit
  // sepanjang hari kerja.
  const { data: riwayat } = await supabaseAdmin
    .from("kunjungan_pantau")
    .select("kunjungan_id, diminta_at, hasil")
    .eq("jenis", "SPOTCHECK")
    .in(
      "kunjungan_id",
      berjalan.map((k) => k.id)
    );

  let dikirim = 0;
  let gagalPush = 0;

  for (const k of berjalan) {
    const usiaMenit = (sekarang - new Date(k.mulai_at)) / MENIT;
    if (usiaMenit < USIA_MIN_SPOTCHECK_MENIT) continue;

    const milikNya = (riwayat || []).filter((r) => r.kunjungan_id === k.id);
    if (milikNya.some((r) => r.hasil == null)) continue; // masih ada yang menggantung
    if (milikNya.length >= MAKS_SPOTCHECK_PER_KUNJUNGAN) continue;

    const terakhir = milikNya.reduce(
      (maks, r) => (r.diminta_at && (!maks || r.diminta_at > maks) ? r.diminta_at : maks),
      null
    );
    if (terakhir && (sekarang - new Date(terakhir)) / MENIT < JEDA_ANTAR_SPOTCHECK_MENIT) continue;

    if (Math.random() > PELUANG_SPOTCHECK) continue;

    // Push dikirim DULU, barisnya menyusul. Urutan sebaliknya bikin baris yang
    // pushnya gagal tetap tercatat dan berujung TIDAK_DIJAWAB — pelanggaran
    // yang lahir dari izin notifikasi yang belum diberikan atau push service
    // yang sedang down, bukan dari perilaku orangnya.
    //
    // sendPush mengembalikan false kalau akun itu belum punya subscription
    // sama sekali (belum mengizinkan notifikasi, atau di iPhone belum
    // menambahkan app ke Home Screen — lihat components/PushNotificationSetup).
    // Itu ikut tercakup di sini, jadi tidak perlu dicek terpisah.
    const terkirim = await sendPush(k.profile_id, {
      title: "📍 Konfirmasi lokasi",
      body:
        `Anda tercatat sedang berkunjung di ${k.proyek?.nama || "proyek"}. ` +
        `Buka aplikasi dalam ${BATAS_JAWAB_SPOTCHECK_MENIT} menit — lokasi terkirim otomatis. ` +
        `Kalau tidak dijawab, kunjungan ini ditandai tidak sah.`,
      url: "/supervisor",
    });
    if (!terkirim) {
      gagalPush++;
      continue;
    }

    const { error: gagal } = await supabaseAdmin.from("kunjungan_pantau").insert({
      kunjungan_id: k.id,
      jenis: "SPOTCHECK",
      diminta_at: sekarang.toISOString(),
      batas_at: new Date(sekarang.getTime() + BATAS_JAWAB_SPOTCHECK_MENIT * MENIT).toISOString(),
    });
    if (!gagal) dikirim++;
  }

  return NextResponse.json({
    ok: true,
    berjalan: berjalan.length,
    dikirim,
    kedaluwarsa: kedaluwarsa?.length || 0,
    gagal_push: gagalPush,
  });
}
