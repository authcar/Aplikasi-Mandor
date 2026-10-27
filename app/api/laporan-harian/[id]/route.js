import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { bolehKoreksiLaporan } from "@/lib/laporanKoreksi";

export const dynamic = "force-dynamic";

const STATUS_VALID = ["ON_PROGRESS", "DONE", "PERBAIKAN"];

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Bucket 'progres' tidak punya policy hapus untuk user biasa, jadi file dibuang
// lewat service role — HANYA setelah izin sudah diverifikasi di bawah.
// Gagal membuang file tidak membatalkan koreksi (cuma menyisakan file yatim).
const buangFile = (path) => (path ? supabaseAdmin.storage.from("progres").remove([path]).catch(() => {}) : null);

async function muat(id) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return { galat: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: laporan } = await supabase
    .from("laporan_harian")
    .select("id, proyek_id, created_by, created_at, foto_url")
    .eq("id", id)
    .maybeSingle();
  if (!laporan) return { galat: NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 }) };

  if (!bolehKoreksiLaporan({ peran: profile.role, userId: profile.id, laporan }))
    return {
      galat: NextResponse.json(
        {
          error:
            profile.role === "SUPERVISOR"
              ? "Supervisor hanya bisa mengubah laporannya sendiri di hari yang sama."
              : "Tidak diizinkan.",
        },
        { status: 403 }
      ),
    };
  return { supabase, laporan };
}

// PATCH /api/laporan-harian/[id] — multipart: deskripsi, status, foto(File?), hapus_foto("1"?)
export async function PATCH(req, { params }) {
  const { galat, supabase, laporan } = await muat(params.id);
  if (galat) return galat;

  const form = await req.formData();
  const deskripsi = (form.get("deskripsi") || "").toString().trim();
  const status = form.get("status");
  const foto = form.get("foto");
  const hapusFoto = form.get("hapus_foto") === "1";
  if (!deskripsi || !STATUS_VALID.includes(status))
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });

  const patch = { deskripsi, status };
  let fotoBaru = null;
  if (foto && typeof foto === "object" && foto.size > 0) {
    const ext = (foto.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${laporan.proyek_id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("progres")
      .upload(path, foto, { contentType: foto.type, upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
    fotoBaru = path;
    patch.foto_url = path;
  } else if (hapusFoto) {
    patch.foto_url = null;
  }

  const { data, error } = await supabase.from("laporan_harian").update(patch).eq("id", laporan.id).select().maybeSingle();
  if (error || !data) {
    await buangFile(fotoBaru);
    return NextResponse.json(
      { error: error?.message || "Perubahan ditolak. Pastikan Anda berhak mengubah laporan ini." },
      { status: error ? 400 : 403 }
    );
  }

  if ("foto_url" in patch && laporan.foto_url && laporan.foto_url !== patch.foto_url) await buangFile(laporan.foto_url);
  return NextResponse.json({ ok: true, data });
}

// DELETE /api/laporan-harian/[id]
export async function DELETE(_req, { params }) {
  const { galat, supabase, laporan } = await muat(params.id);
  if (galat) return galat;

  const { data, error } = await supabase.from("laporan_harian").delete().eq("id", laporan.id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data?.length)
    return NextResponse.json({ error: "Penghapusan ditolak. Pastikan Anda berhak menghapus laporan ini." }, { status: 403 });

  await buangFile(laporan.foto_url);
  return NextResponse.json({ ok: true });
}
