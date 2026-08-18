import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { hitungJarak, koordinatValid } from "@/lib/geo";

// Absensi kunjungan Supervisor ke proyek.
//
// SEMUA keputusan lokasi diambil di sini, bukan di browser. Client cuma
// mengirim koordinat mentah; server yang mengambil titik proyek, menghitung
// jarak, dan memutuskan diterima/ditolak — lalu menyimpan koordinatnya supaya
// bisa diaudit belakangan.
//
// Penulisan memakai service role, dan tabelnya sengaja tidak punya policy
// insert/update untuk user biasa (lihat supabase/add_kunjungan_supervisor.sql).
// Jadi tidak ada jalan lain membuat kunjungan selain lewat route ini. Ini
// bedanya dengan checkin_harian, yang bisa ditulis langsung dari client
// sehingga pengecekan GPS-nya bisa dilewati lewat devtools.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// GPS ponsel di dalam gedung gampang meleset 30-50 m. Akurasi yang lebih
// buruk dari ini ditolak supaya titik proyek tidak ditetapkan dari fix yang
// ngawur, dan supaya "lolos radius karena kebetulan akurasinya 2 km" tidak
// terjadi.
const AKURASI_MAKS_METER = 100;

const ambilProyek = (id) =>
  supabaseAdmin
    .from("proyek")
    .select("id, nama, lokasi, lat, lng, radius_meter, is_active, supervisor_id")
    .eq("id", id)
    .maybeSingle();

// Validasi payload koordinat yang sama untuk check-in maupun check-out.
function bacaKoordinat(body) {
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const akurasi = body?.accuracy == null ? null : Number(body.accuracy);

  if (!koordinatValid(lat, lng)) return { error: "Koordinat tidak valid" };
  if (akurasi != null && (!Number.isFinite(akurasi) || akurasi < 0))
    return { error: "Akurasi tidak valid" };
  if (akurasi != null && akurasi > AKURASI_MAKS_METER)
    return { error: `Sinyal GPS terlalu lemah (±${Math.round(akurasi)}m). Coba di area terbuka.` };

  return { lat, lng, akurasi };
}

// ============ CHECK-IN ============
// body: { proyek_id, lat, lng, accuracy?, set_titik? }
export async function POST(req) {
  const { profile } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "SUPERVISOR")
    return NextResponse.json({ error: "Hanya Supervisor yang bisa absen kunjungan" }, { status: 403 });

  const body = await req.json();
  const koordinat = bacaKoordinat(body);
  if (koordinat.error) return NextResponse.json({ error: koordinat.error }, { status: 400 });
  const { lat, lng, akurasi } = koordinat;

  if (!body?.proyek_id) return NextResponse.json({ error: "proyek_id wajib" }, { status: 400 });

  const { data: proyek } = await ambilProyek(body.proyek_id);
  if (!proyek || !proyek.is_active)
    return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  // Dicek manual karena penulisan pakai service role (bypass RLS) — ini
  // menggantikan penyaringan yang biasanya dilakukan policy proyek_read.
  if (proyek.supervisor_id !== profile.id)
    return NextResponse.json({ error: "Proyek ini bukan tanggung jawab Anda" }, { status: 403 });

  // Kunjungan berjalan dijaga juga oleh unique index di database; dicek di
  // sini supaya pesannya bisa menyebut proyek mana yang masih terbuka.
  const { data: berjalan } = await supabaseAdmin
    .from("kunjungan_supervisor")
    .select("id, proyek:proyek_id(nama)")
    .eq("profile_id", profile.id)
    .eq("status", "BERJALAN")
    .maybeSingle();
  if (berjalan)
    return NextResponse.json(
      { error: `Masih ada kunjungan berjalan di ${berjalan.proyek?.nama || "proyek lain"}. Absen keluar dulu.` },
      { status: 409 }
    );

  const belumPunyaTitik = proyek.lat == null || proyek.lng == null;

  if (belumPunyaTitik) {
    // Titik proyek ditetapkan dari posisi orang pertama yang check-in, tapi
    // HARUS lewat konfirmasi terpisah di UI — kalau tidak, seseorang yang
    // absen dari luar lokasi diam-diam mengunci titik yang salah untuk
    // semua orang setelahnya. Master bisa mereset lewat detail proyek.
    if (!body?.set_titik)
      return NextResponse.json(
        { perlu_set_titik: true, proyek: { id: proyek.id, nama: proyek.nama, lokasi: proyek.lokasi } },
        { status: 409 }
      );

    await supabaseAdmin
      .from("proyek")
      .update({ lat, lng, titik_diset_oleh: profile.id, titik_diset_at: new Date().toISOString() })
      .eq("id", proyek.id);
  } else {
    const jarak = hitungJarak(lat, lng, proyek.lat, proyek.lng);
    if (jarak > proyek.radius_meter)
      return NextResponse.json(
        {
          error: `Anda ${Math.round(jarak)}m dari ${proyek.nama}. Absen hanya bisa dalam radius ${proyek.radius_meter}m.`,
          jarak: Math.round(jarak),
        },
        { status: 422 }
      );
  }

  const { data, error } = await supabaseAdmin
    .from("kunjungan_supervisor")
    .insert({
      proyek_id: proyek.id,
      profile_id: profile.id,
      mulai_at: new Date().toISOString(),
      lat_masuk: lat,
      lng_masuk: lng,
      akurasi_masuk: akurasi,
    })
    .select("id, proyek_id, mulai_at, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, kunjungan: data, titik_baru: belumPunyaTitik });
}

// ============ CHECK-OUT ============
// body: { id, lat, lng, accuracy? }
export async function PATCH(req) {
  const { profile } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const koordinat = bacaKoordinat(body);
  if (koordinat.error) return NextResponse.json({ error: koordinat.error }, { status: 400 });
  const { lat, lng, akurasi } = koordinat;

  if (!body?.id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const { data: kunjungan } = await supabaseAdmin
    .from("kunjungan_supervisor")
    .select("id, proyek_id, mulai_at")
    .eq("id", body.id)
    .eq("profile_id", profile.id)
    .eq("status", "BERJALAN")
    .maybeSingle();
  if (!kunjungan)
    return NextResponse.json({ error: "Kunjungan berjalan tidak ditemukan" }, { status: 404 });

  const { data: proyek } = await ambilProyek(kunjungan.proyek_id);

  // Absen keluar dari luar radius TIDAK ditolak, tapi ditandai TIDAK_SAH.
  //
  // Kalau ditolak, kunjungan orang yang terlanjur pergi akan menggantung
  // BERJALAN selamanya — dan unique index bikin dia tidak bisa check-in di
  // mana pun lagi. Menutup kunjungan sambil mencatat pelanggarannya jauh
  // lebih berguna daripada memaksa dia kembali ke lokasi cuma untuk menekan
  // tombol.
  let status = "SELESAI";
  let catatan = null;
  if (proyek?.lat != null && proyek?.lng != null) {
    const jarak = hitungJarak(lat, lng, proyek.lat, proyek.lng);
    if (jarak > proyek.radius_meter) {
      status = "TIDAK_SAH";
      catatan = `Absen keluar dari ${Math.round(jarak)}m di luar radius ${proyek.radius_meter}m.`;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("kunjungan_supervisor")
    .update({
      selesai_at: new Date().toISOString(),
      lat_keluar: lat,
      lng_keluar: lng,
      akurasi_keluar: akurasi,
      status,
      catatan_sistem: catatan,
    })
    .eq("id", kunjungan.id)
    .select("id, mulai_at, selesai_at, status, catatan_sistem")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, kunjungan: data });
}
