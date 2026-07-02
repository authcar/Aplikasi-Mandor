import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Cari tukang harian berdasarkan 5 digit awal nomor HP
export async function POST(req) {
  const { digits } = await req.json();

  if (!digits || digits.length !== 5 || !/^\d{5}$/.test(digits)) {
    return NextResponse.json(
      { error: "Masukkan tepat 5 digit nomor HP." },
      { status: 400 }
    );
  }

  // Cari semua tukang harian yang nomornya diawali 5 digit ini
  const { data: rows, error } = await supabaseAdmin
    .from("profiles")
    .select("id, name, phone")
    .eq("role", "TUKANG_HARIAN");

  if (error) {
    return NextResponse.json({ error: "Gagal mengakses data." }, { status: 500 });
  }

  // Filter berdasarkan 5 digit awal
  const matches = (rows || []).filter((r) => {
    const phone = (r.phone || "").replace(/\D/g, "");
    // Normalisasi: 08xxx → strip jadi digits aja, cek prefix
    const normalized = phone.startsWith("62")
      ? "0" + phone.slice(2)
      : phone;
    return normalized.startsWith(digits) || phone.startsWith(digits);
  });

  if (matches.length === 0) {
    return NextResponse.json(
      { error: "Nomor tidak ditemukan. Hubungi mandor." },
      { status: 404 }
    );
  }

  if (matches.length > 1) {
    return NextResponse.json(
      { error: "Nomor ambigu, ada lebih dari satu tukang dengan awalan ini. Hubungi mandor." },
      { status: 409 }
    );
  }

  const profile = matches[0];

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
