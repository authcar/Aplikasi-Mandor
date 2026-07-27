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

// Samakan dengan normalisasi di app/login/page.jsx: kalau input tidak
// mengandung "@", jadikan email sintetis di bawah domain @mandor.app.
function normalizeEmail(raw) {
  const v = (raw || "").trim();
  return v.includes("@") ? v : `${v}@mandor.app`;
}

// POST /api/mandor — buat akun Mandor baru
// body: { name, emailOrUsername, phone? }
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

  const email = normalizeEmail(emailOrUsername);
  const password = randomPassword();

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

  if (phone) {
    await supabaseAdmin.from("profiles").update({ phone }).eq("id", created.user.id);
  }

  return NextResponse.json({
    id: created.user.id,
    name: cleanName,
    email,
    phone: phone || null,
    password,
  });
}

// PATCH /api/mandor — reset password Mandor yang sudah ada
// body: { id }
export async function PATCH(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile.role))
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Param salah." }, { status: 400 });

  // profiles_list_mandor / profiles_list_for_master (RLS) memastikan caller
  // memang berhak melihat profil Mandor ini.
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("role", "MANDOR")
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Mandor tidak ditemukan." }, { status: 404 });

  const password = randomPassword();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: "Gagal reset password." }, { status: 500 });

  return NextResponse.json({ id, password });
}
