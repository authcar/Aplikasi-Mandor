import { menitKunjungan } from "@/lib/format";

// Ratakan baris kunjungan_supervisor jadi bentuk yang dipakai KunjunganList.
// Dipakai dua halaman (riwayat Supervisor & rekap Master) yang query-nya beda
// join-nya — di sini disamakan supaya komponen daftarnya cukup satu.
//
// Pengelompokan bulan memakai zona Asia/Jakarta, bukan UTC. UTC ada di
// BELAKANG WIB, jadi yang bermasalah adalah kunjungan dini hari di awal
// bulan: absen 1 September jam 05:00 WIB tersimpan sebagai 31 Agustus 22:00
// UTC, dan kalau bulannya dipotong mentah dari ISO string ("2026-08") ia
// masuk ke rekap bulan yang salah.
export function petakanKunjungan(rows = []) {
  return rows.map((r) => {
    const tglWIB = new Date(r.mulai_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    return {
      id: r.id,
      proyek_id: r.proyek_id,
      proyek: r.proyek?.nama || "Proyek dihapus",
      supervisor: r.profil?.name || "—",
      mulai_at: r.mulai_at,
      selesai_at: r.selesai_at,
      status: r.status,
      catatan_sistem: r.catatan_sistem,
      akurasi_masuk: r.akurasi_masuk,
      menit: menitKunjungan(r.mulai_at, r.selesai_at),
      bulan: tglWIB.slice(0, 7),
      bulanLabel: new Date(r.mulai_at).toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }),
    };
  });
}
