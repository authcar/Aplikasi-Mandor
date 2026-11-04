import AbsensiPegawaiCard from "@/components/AbsensiPegawaiCard";
import { tanggalWIB } from "@/lib/absensiPegawaiAturan";

// Tempat kartu absen di dashboard peran mana pun. Mengembalikan null untuk
// akun yang tidak wajib absen, jadi aman dipasang di semua dashboard.
//
// Dua query sengaja terpisah dari getSessionProfile(): kalau kolom/tabelnya
// belum ada (migrasi belum dijalankan), error-nya ditelan di sini dan
// dashboard tetap tampil — bukan ikut rusak karena select profil bersama
// gagal.
export default async function AbsensiPegawaiSlot({ supabase, profile }) {
  const { data: izin } = await supabase
    .from("profiles")
    .select("wajib_absen")
    .eq("id", profile.id)
    .maybeSingle();
  if (!izin?.wajib_absen) return null;

  const { data: hariIni } = await supabase
    .from("absensi_pegawai")
    .select("masuk_at, keluar_at, lokasi_masuk, lokasi_keluar, terlambat, pulang_cepat")
    .eq("profile_id", profile.id)
    .eq("tanggal", tanggalWIB())
    .maybeSingle();

  return <AbsensiPegawaiCard nama={profile.name} awal={hariIni} />;
}
