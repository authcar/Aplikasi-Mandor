import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { koordinatValid } from "@/lib/geo";
import { proyekTerdekat } from "@/lib/proyekTerdekat";
import {
  tanggalWIB,
  sudahBukaMasuk,
  apakahTerlambat,
  apakahPulangCepat,
  BUKA_MASUK_JAM,
} from "@/lib/absensiPegawaiAturan";

// Clock in / clock out pegawai.
//
// Jam dan tanggal diambil DI SINI, bukan dari browser — jam HP bisa diubah
// orangnya. Client cuma mengirim koordinat; selfie berstempel tidak pernah
// dikirim (fotonya hanya tampil di layar saat absen, lihat
// components/SelfieStampModal.jsx).
//
// Tidak ada geofence: pegawai boleh absen dari proyek mana pun. Koordinat dan
// akurasi disimpan apa adanya, plus nama proyek terdekat sebagai label kalau
// ada. Penulisan memakai service role karena tabelnya sengaja tanpa policy
// insert/update (supabase/add_absensi_pegawai.sql).
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function bacaPosisi(body) {
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const akurasi = body?.accuracy == null ? null : Number(body.accuracy);
  if (!koordinatValid(lat, lng)) return { error: "Lokasi belum didapat. Nyalakan GPS lalu coba lagi." };
  if (akurasi != null && (!Number.isFinite(akurasi) || akurasi < 0)) return { error: "Akurasi lokasi tidak valid" };
  return { lat, lng, akurasi: akurasi == null ? null : Math.round(akurasi * 10) / 10 };
}

// body: { aksi: "masuk" | "pulang", lat, lng, accuracy? }
export async function POST(req) {
  const { profile } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Dicek dengan service role: kolomnya baru ada setelah migrasi dijalankan,
  // dan akun yang tidak ditandai tidak boleh membuat baris absen.
  const { data: izin, error: izinError } = await supabaseAdmin
    .from("profiles")
    .select("wajib_absen")
    .eq("id", profile.id)
    .maybeSingle();
  if (izinError || !izin?.wajib_absen)
    return NextResponse.json({ error: "Akun ini tidak memakai absensi pegawai" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (body?.aksi !== "masuk" && body?.aksi !== "pulang")
    return NextResponse.json({ error: "aksi harus masuk atau pulang" }, { status: 400 });

  const posisi = bacaPosisi(body);
  if (posisi.error) return NextResponse.json({ error: posisi.error }, { status: 400 });

  const sekarang = new Date();
  const tanggal = tanggalWIB(sekarang);
  const lokasi = await proyekTerdekat(supabaseAdmin, posisi.lat, posisi.lng);

  if (body.aksi === "masuk") {
    if (!sudahBukaMasuk(sekarang))
      return NextResponse.json(
        { error: `Absen masuk baru dibuka jam ${String(BUKA_MASUK_JAM).padStart(2, "0")}:00` },
        { status: 400 }
      );

    const { data, error } = await supabaseAdmin
      .from("absensi_pegawai")
      .insert({
        profile_id: profile.id,
        tanggal,
        masuk_at: sekarang.toISOString(),
        lat_masuk: posisi.lat,
        lng_masuk: posisi.lng,
        akurasi_masuk: posisi.akurasi,
        lokasi_masuk: lokasi,
        terlambat: apakahTerlambat(sekarang),
      })
      .select("masuk_at, lokasi_masuk, terlambat")
      .single();

    // 23505 = unique (profile_id, tanggal): sudah absen masuk hari ini.
    if (error?.code === "23505")
      return NextResponse.json({ error: "Anda sudah absen masuk hari ini" }, { status: 409 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, ...data });
  }

  // pulang — `.is("keluar_at", null)` menjaga supaya absen pulang tidak
  // tertimpa kalau tombolnya terketuk dua kali.
  const { data, error } = await supabaseAdmin
    .from("absensi_pegawai")
    .update({
      keluar_at: sekarang.toISOString(),
      lat_keluar: posisi.lat,
      lng_keluar: posisi.lng,
      akurasi_keluar: posisi.akurasi,
      lokasi_keluar: lokasi,
      pulang_cepat: apakahPulangCepat(sekarang),
    })
    .eq("profile_id", profile.id)
    .eq("tanggal", tanggal)
    .is("keluar_at", null)
    .select("keluar_at, lokasi_keluar, pulang_cepat")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) {
    // Salah satu dari dua: belum absen masuk, atau pulang sudah tercatat.
    const { data: ada } = await supabaseAdmin
      .from("absensi_pegawai")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("tanggal", tanggal)
      .maybeSingle();
    return NextResponse.json(
      { error: ada ? "Anda sudah absen pulang hari ini" : "Anda belum absen masuk hari ini" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, ...data });
}
