import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { bacaKoordinat, jarakEfektif } from "@/lib/kunjunganLokasi";
import { jawabSpotcheckTerbuka } from "@/lib/kunjunganPantau";

// POST /api/kunjungan/pantau — posisi di TENGAH kunjungan yang sedang berjalan.
//
// Satu endpoint untuk dua hal, karena payload dan penilaiannya identik:
//   • heartbeat berkala dari components/KunjunganCard selama aplikasi terbuka;
//   • jawaban atas spot-check yang pushnya dikirim lewat web push.
//
// Spot-check yang menggantung dijawab OTOMATIS oleh heartbeat mana pun yang
// masuk, bukan cuma oleh tap tombol. Kalau aplikasinya terbuka, heartbeat
// sudah membuktikan posisinya — menyuruh orangnya menekan tombol konfirmasi
// lagi tidak menambah informasi apa pun, cuma gangguan. Efeknya spot-check
// hanya benar-benar terlewat kalau aplikasinya memang tertutup, dan itu
// persis lubang yang mau ditambalnya.
//
// Sama seperti /api/kunjungan: SEMUA keputusan jarak diambil di sini dan
// ditulis pakai service role. Client cuma mengirim koordinat mentah.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Heartbeat yang datang lebih rapat dari ini tidak menambah baris baru.
//
// Intervalnya diatur client (INTERVAL_HEARTBEAT_MENIT), dan client tidak bisa
// dipercaya: tab ganda, tombol refresh, atau skrip iseng bisa mengirim tiap
// detik dan membanjiri tabel. Yang dijaga di sini kepadatan datanya, bukan
// keamanannya — pengirimnya toh sudah dipastikan pemilik kunjungan.
const JEDA_MIN_HEARTBEAT_DETIK = 60;

export async function POST(req) {
  const { profile } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const koordinat = bacaKoordinat(body);
  if (koordinat.error) return NextResponse.json({ error: koordinat.error }, { status: 400 });
  const { lat, lng, akurasi } = koordinat;

  if (!body?.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  // Dikunci ke BERJALAN dan ke pemiliknya: pantauan pada kunjungan yang sudah
  // ditutup tidak boleh bisa disisipkan belakangan untuk mengubah penilaian
  // yang sudah jadi.
  const { data: kunjungan } = await supabaseAdmin
    .from("kunjungan_supervisor")
    .select("id, proyek_id")
    .eq("id", body.id)
    .eq("profile_id", profile.id)
    .eq("status", "BERJALAN")
    .maybeSingle();
  if (!kunjungan)
    return NextResponse.json({ error: "Kunjungan berjalan tidak ditemukan" }, { status: 404 });

  const { data: proyek } = await supabaseAdmin
    .from("proyek")
    .select("id, lat, lng, radius_meter")
    .eq("id", kunjungan.proyek_id)
    .maybeSingle();

  const jarak = jarakEfektif(lat, lng, proyek, akurasi);

  // Proyek tanpa titik acuan tidak bisa dinilai — dan itu bukan kesalahan
  // orangnya. Diterima diam-diam tanpa menulis apa pun; jangan sampai
  // kunjungan jadi TIDAK_SAH gara-gara titik proyeknya yang belum di-set.
  if (jarak == null || proyek?.radius_meter == null)
    return NextResponse.json({ ok: true, hasil: null });

  const hasil = jarak > proyek.radius_meter ? "DI_LUAR" : "DI_DALAM";

  // Dicek dulu SEBELUM dijawab — sesudahnya barisnya sudah tidak menggantung
  // lagi, jadi tidak ada cara tahu tadi ada atau tidak. Client memakai ini
  // untuk memuat ulang banner spot-check-nya.
  const { count: spotcheckTerbuka } = await supabaseAdmin
    .from("kunjungan_pantau")
    .select("id", { count: "exact", head: true })
    .eq("kunjungan_id", kunjungan.id)
    .eq("jenis", "SPOTCHECK")
    .is("hasil", null);

  if (spotcheckTerbuka) {
    await jawabSpotcheckTerbuka(kunjungan.id, { lat, lng, akurasi, jarak, hasil });
  } else {
    // Baris HEARTBEAT hanya ditulis kalau pembacaan ini TIDAK dipakai menjawab
    // spot-check. Satu pembacaan GPS harus menghasilkan satu baris: ditulis
    // dua-duanya, posisi yang sama terhitung dua pelanggaran saat kunjungan
    // dinilai — rekapnya berbunyi seolah orangnya ketahuan di luar radius dua
    // kali padahal cuma satu kali diperiksa.
    const { data: terakhir } = await supabaseAdmin
      .from("kunjungan_pantau")
      .select("created_at")
      .eq("kunjungan_id", kunjungan.id)
      .eq("jenis", "HEARTBEAT")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const terlaluRapat =
      terakhir &&
      Date.now() - new Date(terakhir.created_at).getTime() < JEDA_MIN_HEARTBEAT_DETIK * 1000;

    if (!terlaluRapat)
      await supabaseAdmin.from("kunjungan_pantau").insert({
        kunjungan_id: kunjungan.id,
        jenis: "HEARTBEAT",
        waktu: new Date().toISOString(),
        lat,
        lng,
        akurasi,
        jarak,
        hasil,
      });
  }

  return NextResponse.json({
    ok: true,
    hasil,
    jarak: Math.round(jarak),
    radius: proyek.radius_meter,
    spotcheck_terjawab: !!spotcheckTerbuka,
  });
}
