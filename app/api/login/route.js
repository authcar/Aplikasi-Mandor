import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Normalisasi nomor HP → strip +62 / 62 prefix jadi 08xxx
function normalizePhone(raw) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  return d;
}

export async function POST(req) {
  const { phone } = await req.json();
  const digits = normalizePhone(phone);

  if (digits.length < 4) {
    return NextResponse.json({ error: "Nomor HP minimal 4 digit." }, { status: 400 });
  }

  // Cari profile yang nomornya cocok (coba beberapa format)
  const formats = [
    digits,
    "62" + digits.slice(1),       // 62xxx
    "+" + "62" + digits.slice(1), // +62xxx
  ];

  let profile = null;
  for (const fmt of formats) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", fmt)
      .maybeSingle();
    if (data) { profile = data; break; }
  }

  // Fallback: cari yang phone LIKE digits (partial match dari belakang)
  if (!profile) {
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, phone");
    profile = rows?.find((r) => {
      const p = normalizePhone(r.phone || "");
      return p === digits || p.endsWith(digits.slice(-8));
    }) || null;
  }

  if (!profile) {
    return NextResponse.json(
      { error: "Nomor HP tidak dikenali. Hubungi supervisor." },
      { status: 404 }
    );
  }

  // Ambil email dari auth.users
  const { data: { user }, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  if (userErr || !user) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  // Buat magic link token → client pakai untuk sign in tanpa password
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (linkErr || !linkData) {
    return NextResponse.json({ error: "Gagal membuat sesi. Coba lagi." }, { status: 500 });
  }

  return NextResponse.json({
    token_hash: linkData.properties.hashed_token,
    email: user.email,
  });
}
