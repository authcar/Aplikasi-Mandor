import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/supabase/server";
import { dalamIndonesia, uraikanKoordinat } from "@/lib/geo";

// DELETE /api/proyek/titik — Master menghapus titik acuan GPS sebuah proyek
// supaya bisa di-set ulang.
//
// Titik proyek ditetapkan otomatis dari posisi Supervisor yang pertama kali
// absen masuk di sana (lihat app/api/kunjungan/route.js). Kalau orang pertama
// itu ternyata absen dari luar lokasi, titiknya melenceng dan SEMUA orang
// setelahnya ikut ditolak — jadi harus ada jalan membatalkannya. Setelah
// direset, absen masuk berikutnya akan menetapkan titik baru.
//
// body: { id }
// Pakai client ber-session (bukan service-role) supaya tunduk RLS
// proyek_write — pola sama dengan app/api/proyek/route.js.
export async function DELETE(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "MASTER")
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const { error } = await supabase
    .from("proyek")
    .update({ lat: null, lng: null, titik_diset_oleh: null, titik_diset_at: null })
    .eq("id", id);

  if (error)
    return NextResponse.json(
      { error: "Gagal menghapus titik. Proyek tidak ditemukan atau tidak diizinkan." },
      { status: 400 }
    );

  return NextResponse.json({ ok: true });
}

// PUT /api/proyek/titik — Master menetapkan titik acuan dengan menempel
// koordinat dari Google Maps.
//
// Ini jalur yang seharusnya dipakai, dan alasannya bukan kenyamanan.
// Penetapan lewat check-in (app/api/kunjungan/route.js) punya cacat mendasar:
// yang menetapkan titik adalah orang yang juga DINILAI oleh titik itu. Kalau
// supervisor pertama menetapkannya dari rumah, seluruh geofence proyek itu
// berpusat di rumahnya sampai ada yang menyadari — dan tidak ada di sistem
// yang bisa membedakannya dari titik yang benar. Di sini titiknya ditetapkan
// Master, yang tidak punya kepentingan memalsukannya.
//
// Jalur check-in sengaja TIDAK dimatikan: kalau Master belum sempat menetapkan
// titik, lapangan tetap bisa jalan. Yang berubah cuma, sekarang ada cara benar
// yang bisa dipakai sejak awal, dan `titik_diset_oleh` tetap merekam siapa
// yang memakai jalur mana.
//
// body: { id, koordinat }  — `koordinat` teks mentah hasil tempel, diurai di
// sini supaya aturannya satu tempat dan client tidak bisa mengirim angka yang
// tidak pernah lolos penguraian.
export async function PUT(req) {
  const { profile, supabase } = await getSessionProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "MASTER")
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });

  const { id, koordinat } = await req.json();
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });

  const titik = uraikanKoordinat(koordinat);
  if (!titik)
    return NextResponse.json(
      {
        error:
          "Koordinat tidak terbaca. Tempel dalam bentuk \"-6.215008, 106.736006\" " +
          "atau tempel langsung link Google Maps-nya.",
      },
      { status: 400 }
    );

  if (!dalamIndonesia(titik.lat, titik.lng))
    return NextResponse.json(
      {
        error:
          `Titik ${titik.lat}, ${titik.lng} berada di luar Indonesia. ` +
          "Biasanya ini karena angka lintang & bujurnya tertukar atau tanda minusnya hilang.",
      },
      { status: 400 }
    );

  const { error } = await supabase
    .from("proyek")
    .update({
      lat: titik.lat,
      lng: titik.lng,
      titik_diset_oleh: profile.id,
      titik_diset_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error)
    return NextResponse.json(
      { error: "Gagal menyimpan titik. Proyek tidak ditemukan atau tidak diizinkan." },
      { status: 400 }
    );

  return NextResponse.json({ ok: true, titik });
}
