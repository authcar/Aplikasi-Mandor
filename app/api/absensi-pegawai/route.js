import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { koordinatValid } from "@/lib/geo";
import { proyekTerdekat } from "@/lib/proyekTerdekat";
import { cariAlamat } from "@/lib/geocode";
import {
  tanggalWIB,
  sudahBukaMasuk,
  apakahTerlambat,
  apakahPulangCepat,
  BUKA_MASUK_JAM,
  BUCKET_ABSENSI,
  pathFoto,
} from "@/lib/absensiPegawaiAturan";

// Clock in / clock out pegawai.
//
// Jam dan tanggal diambil DI SINI, bukan dari browser — jam HP bisa diubah
// orangnya. Client mengirim koordinat + selfie berstempel (multipart); alamat
// dicari ulang di server, bukan dipercaya dari client.
//
// Foto disimpan ke bucket privat setelah baris absennya berhasil ditulis, bukan
// sebelumnya: penjaga duplikat (unique / `.is("keluar_at", null)`) ada di
// query-nya, jadi ketukan ganda tidak bisa menimpa foto yang sudah tersimpan.
// Kalau unggah fotonya gagal, absennya tetap tercatat (response memberi tahu).
//
// Tidak ada geofence: pegawai boleh absen dari proyek mana pun. Penulisan
// memakai service role karena tabelnya sengaja tanpa policy insert/update
// (supabase/add_absensi_pegawai.sql).
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const FOTO_MAKS_BYTE = 2 * 1024 * 1024;

function bacaPosisi(form) {
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  const mentah = form.get("accuracy");
  const akurasi = mentah == null || mentah === "" ? null : Number(mentah);
  if (!koordinatValid(lat, lng)) return { error: "Lokasi belum didapat. Nyalakan GPS lalu coba lagi." };
  if (akurasi != null && (!Number.isFinite(akurasi) || akurasi < 0)) return { error: "Akurasi lokasi tidak valid" };
  return { lat, lng, akurasi: akurasi == null ? null : Math.round(akurasi * 10) / 10 };
}

async function bacaFoto(form) {
  const f = form.get("foto");
  if (!f || typeof f === "string") return { error: "Foto selfie wajib diambil." };
  if (f.size > FOTO_MAKS_BYTE) return { error: "Foto terlalu besar. Ulangi pengambilan foto." };
  const buf = Buffer.from(await f.arrayBuffer());
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return { error: "Format foto tidak dikenali." };
  return { buf };
}

// Unggah + tulis path ke baris absen. Mengembalikan true kalau keduanya berhasil.
async function simpanFoto({ buf, path, kolom, profileId, tanggal }) {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_ABSENSI)
    .upload(path, buf, { contentType: "image/jpeg", upsert: true });
  if (error) {
    console.error("absensi-pegawai: unggah foto gagal:", error.message);
    return false;
  }
  const { error: errUpdate } = await supabaseAdmin
    .from("absensi_pegawai")
    .update({ [kolom]: path })
    .eq("profile_id", profileId)
    .eq("tanggal", tanggal);
  if (errUpdate) {
    console.error("absensi-pegawai: simpan path foto gagal:", errUpdate.message);
    return false;
  }
  return true;
}

// multipart: aksi ("masuk" | "pulang"), lat, lng, accuracy?, foto (JPEG)
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

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Muat ulang aplikasi lalu coba lagi." }, { status: 400 });

  const aksi = form.get("aksi");
  if (aksi !== "masuk" && aksi !== "pulang")
    return NextResponse.json({ error: "aksi harus masuk atau pulang" }, { status: 400 });

  const posisi = bacaPosisi(form);
  if (posisi.error) return NextResponse.json({ error: posisi.error }, { status: 400 });

  const foto = await bacaFoto(form);
  if (foto.error) return NextResponse.json({ error: foto.error }, { status: 400 });

  const sekarang = new Date();
  const tanggal = tanggalWIB(sekarang);
  const [lokasi, alamat] = await Promise.all([
    proyekTerdekat(supabaseAdmin, posisi.lat, posisi.lng),
    cariAlamat(posisi.lat, posisi.lng),
  ]);

  if (aksi === "masuk") {
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
        alamat_masuk: alamat,
        terlambat: apakahTerlambat(sekarang),
      })
      .select("masuk_at, lokasi_masuk, alamat_masuk, terlambat")
      .single();

    // 23505 = unique (profile_id, tanggal): sudah absen masuk hari ini.
    if (error?.code === "23505")
      return NextResponse.json({ error: "Anda sudah absen masuk hari ini" }, { status: 409 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const fotoOk = await simpanFoto({
      buf: foto.buf,
      path: pathFoto(tanggal, profile.id, "masuk"),
      kolom: "foto_masuk_path",
      profileId: profile.id,
      tanggal,
    });
    return NextResponse.json({ ok: true, ...data, foto_tersimpan: fotoOk });
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
      alamat_keluar: alamat,
      pulang_cepat: apakahPulangCepat(sekarang),
    })
    .eq("profile_id", profile.id)
    .eq("tanggal", tanggal)
    .is("keluar_at", null)
    .select("keluar_at, lokasi_keluar, alamat_keluar, pulang_cepat")
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

  const fotoOk = await simpanFoto({
    buf: foto.buf,
    path: pathFoto(tanggal, profile.id, "pulang"),
    kolom: "foto_keluar_path",
    profileId: profile.id,
    tanggal,
  });
  return NextResponse.json({ ok: true, ...data, foto_tersimpan: fotoOk });
}
