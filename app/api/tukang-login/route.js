import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const GENERIC_AUTH_ERROR = "Nomor HP atau PIN salah. Hubungi mandor.";

// Cari tukang harian berdasarkan 4 digit terakhir nomor HP, lalu wajib
// cocok dengan PIN rahasia sebelum sesi login dibuat.
export async function POST(req) {
  const { digits, pin } = await req.json();

  if (!digits || digits.length !== 4 || !/^\d{4}$/.test(digits)) {
    return NextResponse.json(
      { error: "Masukkan tepat 4 digit terakhir nomor HP." },
      { status: 400 }
    );
  }

  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: "Masukkan PIN 4 digit." },
      { status: 400 }
    );
  }

  // Cari semua tukang harian yang nomornya berakhiran 4 digit ini
  const { data: rows, error } = await supabaseAdmin
    .from("profiles")
    .select("id, name, phone, pin")
    .eq("role", "TUKANG_HARIAN");

  if (error) {
    return NextResponse.json({ error: "Gagal mengakses data." }, { status: 500 });
  }

  const matches = (rows || []).filter((r) =>
    (r.phone || "").replace(/\D/g, "").endsWith(digits)
  );

  if (matches.length === 0) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 404 });
  }

  if (matches.length > 1) {
    return NextResponse.json(
      { error: "Nomor ambigu, ada lebih dari satu tukang dengan akhiran ini. Hubungi mandor." },
      { status: 409 }
    );
  }

  const profile = matches[0];

  // PIN wajib cocok. Kalau akun belum punya PIN sama sekali, tetap ditolak
  // (bukan di-skip) supaya mandor sadar harus di-set dulu.
  if (!profile.pin || profile.pin !== pin) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }

  const {
    data: { user },
    error: userErr,
  } = await supabaseAdmin.auth.admin.getUserById(profile.id);

  if (userErr || !user) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });

  if (linkErr || !linkData) {
    return NextResponse.json({ error: "Gagal membuat sesi. Coba lagi." }, { status: 500 });
  }

  return NextResponse.json({
    token_hash: linkData.properties.hashed_token,
    email: user.email,
    name: profile.name,
  });
}
