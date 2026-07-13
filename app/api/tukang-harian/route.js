import { randomUUID } from "crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALLOWED_ROLES = ["MANDOR", "SUPERVISOR", "MASTER"];

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Normalisasi nomor HP -> 08xxxxxxxxxx
function normalizePhone(raw) {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  return d;
}

// POST /api/tukang-harian — buat akun tukang harian baru + PIN awal
// body: { name, phone, proyek_id }
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile.role))
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { name, phone, proyek_id } = await req.json();
  const cleanName = (name || "").trim();
  const digits = normalizePhone(phone);

  if (!cleanName) return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });
  if (digits.length < 9)
    return NextResponse.json({ error: "Nomor HP tidak valid." }, { status: 400 });
  if (!proyek_id) return NextResponse.json({ error: "Pilih proyek." }, { status: 400 });

  // proyek_read (RLS) memastikan proyek ini memang terjangkau oleh caller.
  const { data: proyek } = await supabase
    .from("proyek")
    .select("id")
    .eq("id", proyek_id)
    .maybeSingle();
  if (!proyek) return NextResponse.json({ error: "Proyek tidak ditemukan." }, { status: 404 });

  const { data: dupRows } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", digits)
    .limit(1);
  if (dupRows && dupRows.length > 0)
    return NextResponse.json({ error: "Nomor HP sudah terdaftar." }, { status: 409 });

  const pin = randomPin();
  const email = `tukang.${digits}@tukang.internal`;

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { name: cleanName, role: "TUKANG_HARIAN" },
  });
  if (createErr || !created?.user) {
    return NextResponse.json(
      { error: createErr?.message || "Gagal membuat akun." },
      { status: 500 }
    );
  }

  const { error: updateErr } = await supabaseAdmin
    .from("profiles")
    .update({ phone: digits, proyek_id, pin })
    .eq("id", created.user.id);

  if (updateErr) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "Gagal menyimpan data tukang." }, { status: 500 });
  }

  return NextResponse.json({
    id: created.user.id,
    name: cleanName,
    phone: digits,
    proyek_id,
    pin,
  });
}

// PATCH /api/tukang-harian — reset PIN tukang harian yang sudah ada
// body: { id }
export async function PATCH(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile.role))
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Param salah." }, { status: 400 });

  // profiles_list_tukang_harian (RLS) memastikan baris ini memang di proyek caller.
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("role", "TUKANG_HARIAN")
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "Tukang tidak ditemukan." }, { status: 404 });

  const pin = randomPin();
  const { error } = await supabaseAdmin.from("profiles").update({ pin }).eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal reset PIN." }, { status: 500 });

  return NextResponse.json({ id, pin });
}
