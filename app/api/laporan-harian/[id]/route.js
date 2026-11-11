import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/supabase/server";
import { bolehKoreksiLaporan } from "@/lib/laporanKoreksi";
import { klienLaporan } from "@/lib/laporanAkses";
import { daftarFoto, fileFoto, kolomFoto, MAKS_FOTO_KEGIATAN } from "@/lib/laporanFoto";

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
// Menerima satu path atau daftar path.
const buangFile = (paths) => {
  const daftar = [paths].flat().filter(Boolean);
  return daftar.length ? supabaseAdmin.storage.from("progres").remove(daftar).catch(() => {}) : null;
};

async function muat(id) {
  const { profile, supabase: supabaseUser } = await getSessionProfile();
  if (!profile) return { galat: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  // Head of Production: RLS tidak mengenalnya, jadi dibaca lewat service role;
  // izin sebenarnya ditentukan bolehKoreksiLaporan di bawah.
  const supabase = klienLaporan(profile, supabaseUser);

  const { data: laporan } = await supabase
    .from("laporan_harian")
    .select("id, proyek_id, created_by, created_at, foto_url, foto_urls")
    .eq("id", id)
    .maybeSingle();
  if (!laporan) return { galat: NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 }) };

  if (!bolehKoreksiLaporan({ peran: profile.role, userId: profile.id, laporan }))
    return {
      galat: NextResponse.json(
        {
          error:
            profile.role === "SUPERVISOR" || profile.role === "HEAD_OF_PRODUCTION"
              ? "Hanya bisa mengubah laporan sendiri."
              : "Tidak diizinkan.",
        },
        { status: 403 }
      ),
    };
  return { supabase, laporan };
}

// PATCH /api/laporan-harian/[id] — multipart: deskripsi, status, foto(File, boleh berulang; ditambahkan), hapus_foto("1"? buang semua foto lama), buang_foto(path, boleh berulang; buang foto tertentu)
export async function PATCH(req, { params }) {
  const { galat, supabase, laporan } = await muat(params.id);
  if (galat) return galat;

  const form = await req.formData();
  const deskripsi = (form.get("deskripsi") || "").toString().trim();
  const status = form.get("status");
  const fotos = fileFoto(form); // foto baru: DITAMBAHKAN ke yang sudah ada
  const hapusFoto = form.get("hapus_foto") === "1"; // buang semua foto lama dulu
  const lama = daftarFoto(laporan);
  // buang_foto (boleh berulang): foto lama tertentu yang dibuang. Hanya path yang
  // memang milik laporan ini yang dihiraukan — path lain diabaikan.
  const buangSatuan = new Set(form.getAll("buang_foto").map(String).filter((p) => lama.includes(p)));
  const sisaLama = hapusFoto ? [] : lama.filter((p) => !buangSatuan.has(p));
  if (!deskripsi || !STATUS_VALID.includes(status))
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  if (sisaLama.length + fotos.length > MAKS_FOTO_KEGIATAN)
    return NextResponse.json({ error: `Maksimal ${MAKS_FOTO_KEGIATAN} foto per kegiatan.` }, { status: 400 });

  const patch = { deskripsi, status };
  const baru = [];
  for (const foto of fotos) {
    const ext = (foto.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${laporan.proyek_id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("progres")
      .upload(path, foto, { contentType: foto.type, upsert: false });
    if (upErr) {
      await buangFile(baru);
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }
    baru.push(path);
  }
  const dibuang = lama.filter((p) => !sisaLama.includes(p));
  if (dibuang.length || baru.length) Object.assign(patch, kolomFoto([...sisaLama, ...baru]));

  const { data, error } = await supabase.from("laporan_harian").update(patch).eq("id", laporan.id).select().maybeSingle();
  if (error || !data) {
    await buangFile(baru);
    return NextResponse.json(
      { error: error?.message || "Perubahan ditolak. Pastikan Anda berhak mengubah laporan ini." },
      { status: error ? 400 : 403 }
    );
  }

  await buangFile(dibuang);
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

  await buangFile(daftarFoto(laporan));
  return NextResponse.json({ ok: true });
}
