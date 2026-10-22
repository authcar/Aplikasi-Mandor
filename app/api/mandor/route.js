import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALLOWED_ROLES = ["SUPERVISOR", "MASTER", "FINANCE"];

function randomPassword() {
  // 10 karakter acak, mudah diketik ulang (tanpa simbol yang gampang salah baca).
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Normalisasi nomor HP -> 08xxxxxxxxxx (sama dengan app/api/tukang-harian)
function normalizePhone(raw) {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  return d;
}

// Samakan dengan normalisasi di app/login/page.jsx: kalau input tidak
// mengandung "@", jadikan email sintetis di bawah domain @mandor.app.
function normalizeEmail(raw) {
  const v = (raw || "").trim();
  return v.includes("@") ? v : `${v}@mandor.app`;
}

// POST /api/mandor — buat akun Mandor baru
// body: { name, emailOrUsername, phone }
export async function POST(req) {
  const { profile } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile.role))
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { name, emailOrUsername, phone } = await req.json();
  const cleanName = (name || "").trim();
  if (!cleanName) return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });
  if (!emailOrUsername || !emailOrUsername.trim())
    return NextResponse.json({ error: "Email/username wajib diisi." }, { status: 400 });

  const digits = normalizePhone(phone);
  if (digits.length < 9)
    return NextResponse.json({ error: "Nomor HP wajib diisi (dipakai untuk login)." }, { status: 400 });

  const { data: dupRows } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", digits)
    .limit(1);
  if (dupRows && dupRows.length > 0)
    return NextResponse.json({ error: "Nomor HP sudah terdaftar." }, { status: 409 });

  const email = normalizeEmail(emailOrUsername);
  const password = randomPassword();
  const pin = randomPin();

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: cleanName, role: "MANDOR" },
  });
  if (createErr || !created?.user) {
    const msg = /already.*registered|already.*exists/i.test(createErr?.message || "")
      ? "Email/username ini sudah dipakai."
      : createErr?.message || "Gagal membuat akun.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { error: updateErr } = await supabaseAdmin
    .from("profiles")
    .update({ phone: digits, pin })
    .eq("id", created.user.id);
  if (updateErr) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "Gagal menyimpan data mandor." }, { status: 500 });
  }

  return NextResponse.json({
    id: created.user.id,
    name: cleanName,
    email,
    phone: digits,
    password,
    pin,
  });
}

// PATCH /api/mandor — reset PIN login Mandor yang sudah ada
// body: { id, phone? } — phone wajib kalau mandor belum punya nomor HP

export async function PATCH(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile.role))
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { id, phone } = await req.json();
  if (!id) return NextResponse.json({ error: "Param salah." }, { status: 400 });

  // profiles_list_mandor / profiles_list_for_master (RLS) memastikan caller
  // memang berhak melihat profil Mandor ini.
  const { data: target } = await supabase
    .from("profiles")
    .select("id, phone")
    .eq("id", id)
    .eq("role", "MANDOR")
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Mandor tidak ditemukan." }, { status: 404 });

  const digits = normalizePhone(phone || target.phone);
  if (digits.length < 9)
    return NextResponse.json({ error: "Nomor HP mandor belum diisi." }, { status: 400 });
  if (digits !== target.phone) {
    const { data: dupRows } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", digits)
      .neq("id", id)
      .limit(1);
    if (dupRows && dupRows.length > 0)
      return NextResponse.json({ error: "Nomor HP sudah terdaftar." }, { status: 409 });
  }

  const pin = randomPin();
  const { error } = await supabaseAdmin.from("profiles").update({ phone: digits, pin }).eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal reset PIN." }, { status: 500 });

  return NextResponse.json({ id, phone: digits, pin });
}
