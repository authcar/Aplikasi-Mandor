import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

// Pos Biaya = kategori pengeluaran proyek (Beli Bahan, Jasa Tukang,
// Transport, dll), dikelola Finance. Dipakai saat input biaya proyek —
// lihat app/api/biaya-proyek/route.js & supabase/add_biaya_proyek.sql.
export async function GET() {
  const { profile, supabase } = await getSessionProfile();
  if (!profile || profile.role !== "FINANCE")
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { data, error } = await supabase
    .from("pos_biaya")
    .select("id, nama, is_active")
    .order("nama");

  if (error) return NextResponse.json({ error: "Gagal memuat pos biaya." }, { status: 400 });
  return NextResponse.json(data);
}

// body: { nama }
export async function POST(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile || profile.role !== "FINANCE")
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { nama } = await req.json();
  const trimmed = (nama || "").trim();
  if (!trimmed) return NextResponse.json({ error: "Nama pos wajib diisi." }, { status: 400 });

  const { data, error } = await supabase
    .from("pos_biaya")
    .insert({ nama: trimmed, created_by: profile.id })
    .select("id, nama, is_active")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "Nama pos sudah ada." : "Gagal menyimpan pos biaya.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json(data);
}

// body: { id, nama?, is_active? } — rename dan/atau nonaktifkan pos.
// Pos yang sudah dipakai di biaya_proyek sengaja tidak boleh dihapus
// (histori biaya tetap harus nunjuk ke pos yang jelas) — cukup dinonaktifkan
// supaya tidak muncul lagi di pilihan pos baru.
export async function PATCH(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile || profile.role !== "FINANCE")
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { id, nama, is_active } = await req.json();
  if (!id) return NextResponse.json({ error: "Param salah." }, { status: 400 });

  const patch = {};
  if (typeof nama === "string" && nama.trim()) patch.nama = nama.trim();
  if (typeof is_active === "boolean") patch.is_active = is_active;
  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });

  const { data, error } = await supabase
    .from("pos_biaya")
    .update(patch)
    .eq("id", id)
    .select("id, nama, is_active")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "Nama pos sudah ada." : "Gagal menyimpan.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json(data);
}
