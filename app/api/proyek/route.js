import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";

// Kolom proyek yang boleh diinput manual Master lewat endpoint ini.
const EDITABLE_FIELDS = {
  nilai_proyek: "Nilai jasa tukang",
  sisa_budget: "Sisa budget",
};

// PATCH /api/proyek — Master mengubah nilai_proyek (Nilai Jasa Tukang) atau
// sisa_budget (Sisa Budget) proyek. Keduanya field manual, tidak disinkron
// dari Taraco — lihat lib/supabase/syncProyek.js.
// body: { id, field: 'nilai_proyek'|'sisa_budget', value }
// Pakai client ber-session (bukan service-role) supaya tunduk RLS proyek_write
// (my_role() = 'MASTER') — sama pola dengan app/api/mandor/route.js PATCH.
export async function PATCH(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "MASTER")
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { id, field, value } = await req.json();
  if (!id || !EDITABLE_FIELDS[field])
    return NextResponse.json({ error: "Param salah." }, { status: 400 });

  const nilai = Number(value);
  if (!Number.isFinite(nilai) || nilai < 0)
    return NextResponse.json({ error: `${EDITABLE_FIELDS[field]} harus angka >= 0.` }, { status: 400 });

  const { data, error } = await supabase
    .from("proyek")
    .update({ [field]: Math.round(nilai) })
    .eq("id", id)
    .select(`id, ${field}`)
    .single();

  if (error) return NextResponse.json({ error: "Gagal menyimpan. Proyek tidak ditemukan atau tidak diizinkan." }, { status: 400 });

  return NextResponse.json(data);
}
