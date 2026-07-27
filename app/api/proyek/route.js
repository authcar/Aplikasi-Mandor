import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

// PATCH /api/proyek — Master mengubah nilai_proyek (Nilai Jasa Tukang) proyek.
// body: { id, nilai_proyek }
// Pakai client ber-session (bukan service-role) supaya tunduk RLS proyek_write
// (my_role() = 'MASTER') — sama pola dengan app/api/mandor/route.js PATCH.
export async function PATCH(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "MASTER")
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { id, nilai_proyek } = await req.json();
  if (!id) return NextResponse.json({ error: "Param salah." }, { status: 400 });

  const nilai = Number(nilai_proyek);
  if (!Number.isFinite(nilai) || nilai < 0)
    return NextResponse.json({ error: "Nilai jasa tukang harus angka >= 0." }, { status: 400 });

  const { data, error } = await supabase
    .from("proyek")
    .update({ nilai_proyek: Math.round(nilai) })
    .eq("id", id)
    .select("id, nilai_proyek")
    .single();

  if (error) return NextResponse.json({ error: "Gagal menyimpan. Proyek tidak ditemukan atau tidak diizinkan." }, { status: 400 });

  return NextResponse.json(data);
}
