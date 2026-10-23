"use server";
// Semua perubahan data dari area staf portal. Hak akses dicek di sini (tabel
// portal_* tidak punya policy RLS, lihat lib/portal/db.js).
// Tiap aksi mengembalikan {} atau { error } supaya pesan tampil di UI.
import { randomBytes } from "crypto";
import { db, hasil } from "@/lib/portal/db";
import { ambilStaf, bolehProyek } from "@/lib/portal/server";
import { ambilProyek, ambilBobotTahap, bacaProgres } from "@/lib/portal/data";
import { hapusFotoItem } from "@/lib/portal/fotoItem";
import { BUCKET_PROGRES, hapusFotoProgres } from "@/lib/portal/progresFoto";
import { catatRiwayat } from "@/lib/portal/riwayat";
import { BUCKET_DEFECT, hapusFotoDefect } from "@/lib/portal/defect";
import { FASE, JENIS, TAHAP, tahapItem, faseMenghalangi } from "@/lib/portal/progresBoq";
import { JENIS_TERMIN, terminStandar, lewatDeadline, tglTh, hariIni } from "@/lib/portal/format";

const pilih = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

const F_PROYEK = ["nama", "kode", "klien_nama", "lokasi", "mulai", "deadline", "supervisor_id", "aktif", "timbang_harga", "nilai_proyek"];
const F_ITEM = ["area", "kode", "nama", "jenis", "qty", "satuan", "dimensi", "harga", "harga_satuan", "tim", "bobot", "urutan", "foto", "hanya_jasa"];
const F_TERMIN = ["urutan", "jenis", "label", "persen", "jatuh_tempo", "lunas_tgl", "dibayar", "bukti"];

async function jalan(fn, { admin = true } = {}) {
  try {
    const { staf } = await ambilStaf();
    if (!staf) throw new Error("Bukan staf.");
    if (staf.role === "TUKANG") throw new Error("akun tukang hanya bisa melihat.");
    if (admin && staf.role !== "ADMIN") throw new Error("Hanya admin.");
    return (await fn(staf)) || {};
  } catch (e) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    // Kolom baru belum dibuat di Supabase.
    if (/could not find the '\w+' column|column .* does not exist/i.test(e.message || ""))
      return { error: "kolomnya belum ada di database. Jalankan supabase/add_portal_pembayaran.sql, add_portal_termin_jenis.sql, add_portal_bobot_item.sql, add_portal_nilai_proyek.sql, add_portal_jasa_tukang.sql, add_portal_progres_persen.sql, add_portal_item_foto.sql, add_portal_item_hanya_jasa.sql, add_portal_progres_foto.sql, add_portal_progres_foto_tahap.sql, dan add_portal_progres_riwayat.sql di Supabase dulu." };
    return { error: e.message || "Terjadi kesalahan." };
  }
}

function cekItem(r) {
  if (r.jenis && !JENIS.includes(r.jenis)) throw new Error("Jenis tidak valid.");
  if ("bobot" in r && !(Number(r.bobot) > 0)) throw new Error("Bobot harus > 0.");
  if ("nama" in r && !String(r.nama || "").trim()) throw new Error("Nama item wajib.");
  if ("area" in r && !String(r.area || "").trim()) throw new Error("Area wajib.");
  if ("qty" in r && !(Number(r.qty) > 0)) throw new Error("Qty harus > 0.");
  if (r.harga != null && !(Number(r.harga) >= 0)) throw new Error("Total jasa tukang tidak valid.");
  if (r.harga_satuan != null && !(Number(r.harga_satuan) >= 0)) throw new Error("Harga satuan tidak valid.");
  if ("foto" in r && (!Array.isArray(r.foto) || r.foto.length > 5 || r.foto.some((p) => typeof p !== "string")))
    throw new Error("foto item tidak valid.");
  if ("tim" in r) r.tim = String(r.tim || "").trim() || null;
  return r;
}

// Foto item harus milik proyek ini (path diawali id proyek, lihat api/portal/item-foto).
function cekFoto(rows, proyekId) {
  // Insert massal mengisi kolom yang tak ada di sebuah baris dengan NULL (bukan
  // default), padahal portal_item.foto not null: samakan semua baris.
  if (rows.some((r) => r.foto)) for (const r of rows) r.foto ||= [];
  if (rows.some((r) => (r.foto || []).some((p) => !p.startsWith(`${proyekId}/`) || p.includes(".."))))
    throw new Error("foto item bukan milik proyek ini.");
}

function cekTermin(r) {
  if ("jenis" in r && !JENIS_TERMIN.some(([k]) => k === r.jenis)) throw new Error("Jenis termin tidak valid.");
  if ("persen" in r && !(r.persen > 0 && r.persen <= 100)) throw new Error("Persen harus 1–100.");
  if (r.dibayar != null && !(Number(r.dibayar) >= 0)) throw new Error("Nominal diterima tidak valid.");
  return r;
}

// Total persen termin satu jenis tidak boleh lewat
// 100 (sisa tagihan jadi minus).
async function cekTotalTermin(proyekId, jenis, tambahan, kecualiId) {
  const rows = await hasil(db().from("portal_termin").select("id, persen").eq("proyek_id", proyekId).eq("jenis", jenis));
  const total = rows.filter((t) => t.id !== kecualiId).reduce((a, t) => a + Number(t.persen), 0) + tambahan;
  if (total > 100.001)
    throw new Error(`total termin ${jenis} jadi ${Math.round(total * 100) / 100}%, maksimal 100%. Kurangi termin lain dulu.`);
}

// Proyek yang sudah lewat deadline terkunci: tidak ada data yang boleh diubah.
async function cekTerbuka(proyekId) {
  const p = await ambilProyek(proyekId);
  if (!p) throw new Error("Proyek tidak ditemukan.");
  if (lewatDeadline(p)) throw new Error(`proyek sudah lewat deadline ${tglTh(p.deadline)}, jadi terkunci.`);
  return p;
}

// proyek_id pemilik satu baris (item / termin / link).
async function proyekDari(tabel, kolom, nilai) {
  const r = await hasil(db().from(tabel).select("proyek_id").eq(kolom, nilai).maybeSingle());
  if (!r) throw new Error("Data tidak ditemukan.");
  return r.proyek_id;
}

const ubah = (tabel, id, patch) => hasil(db().from(tabel).update(patch).eq("id", id)).then(() => {});
const hapus = (tabel, id) => hasil(db().from(tabel).delete().eq("id", id)).then(() => {});

/* ---------- Proyek ---------- */
export async function buatProyek(f) {
  return jalan(async (staf) => {
    if (!f.nama?.trim()) throw new Error("Nama proyek wajib.");
    const p = await hasil(
      db().from("portal_proyek").insert({ ...pilih(f, F_PROYEK), aktif: true, created_by: staf.id }).select("id").single()
    );
    return { id: p.id };
  });
}

// Deadline hanya bisa diisi sekali; setelah itu tidak bisa diubah atau dikosongkan.
export async function ubahProyek(id, patch) {
  return jalan(async () => {
    const lama = await cekTerbuka(id);
    const p = pilih(patch, F_PROYEK);
    if (p.nilai_proyek != null && !(Number(p.nilai_proyek) >= 0)) throw new Error("nilai proyek tidak valid.");
    if ("deadline" in p && lama.deadline && p.deadline !== lama.deadline)
      throw new Error("deadline sudah ditetapkan dan tidak bisa diubah.");
    await ubah("portal_proyek", id, p);
  });
}

// Hapus permanen, hanya master. Item, progres, termin, dan link klien ikut
// terhapus (on delete cascade). Konfirmasi dilakukan di UI. Proyek yang sudah terkunci (lewat deadline) tetap bisa dihapus.
async function hapusSatuProyek(id) {
  const fotoItem = await hasil(db().from("portal_item").select("*").eq("proyek_id", id));
  await hapusFotoItem(fotoItem.flatMap((i) => i.foto || []));
  await hapusFotoItem((await hasil(db().from("portal_termin").select("*").eq("proyek_id", id))).map((t) => t.bukti));
  await hapusFotoDefect(id); // baris defect ikut terhapus (cascade), fotonya tidak
  await hapusFotoProgres({ proyekId: id });
  await hapus("portal_proyek", id);
}

export async function hapusProyek(id) {
  return jalan(async () => {
    if (!(await ambilProyek(id))) throw new Error("Proyek tidak ditemukan.");
    await hapusSatuProyek(id);
  });
}

// Hapus beberapa proyek sekaligus dari beranda (pilih kartu, lalu konfirmasi di
// UI). Isi yang ikut terhapus sama dengan hapusProyek.
export async function hapusBanyakProyek(ids) {
  return jalan(async () => {
    if (!Array.isArray(ids) || !ids.length || ids.length > 50) throw new Error("pilih 1–50 proyek.");
    for (const id of ids) {
      if (await ambilProyek(id)) await hapusSatuProyek(id);
    }
  });
}

/* ---------- Progres (admin & supervisor proyek) ---------- */
// persen = seberapa jauh tahap dikerjakan: 1–100 dicatat (tanggal = hari ini),
// 0 = batal (baris dihapus).
// Jumlah foto progres satu item untuk satu tahap. null = tidak bisa dicek (tabel/kolom foto belum dibuat),
// supaya pencatatan progres tetap jalan sebelum SQL foto dijalankan.
async function jumlahFotoTahap(itemId, tahap) {
  try {
    const { count, error } = await db().from("portal_progres_foto").select("id", { count: "exact", head: true }).eq("item_id", itemId).eq("tahap", tahap);
    return error ? null : count ?? 0;
  } catch {
    return null;
  }
}

export async function setProgres(itemId, tahap, persen) {
  return jalan(async (staf) => {
    persen = Math.round(Number(persen) * 100) / 100;
    if (!(persen >= 0 && persen <= 100)) throw new Error("persen tahap harus 0–100.");
    // Foto tahap ini dicek bersamaan dengan pengambilan item (hanya dipakai kalau persen > 0).
    const fotoTahap = persen > 0 ? jumlahFotoTahap(itemId, tahap) : Promise.resolve(null);
    const row = await hasil(db().from("portal_item").select("*, portal_progres(*)").eq("id", itemId).maybeSingle());
    if (!row) throw new Error("Item tidak ditemukan.");
    // Proyek dan bobot bawaan diambil bersamaan (bobot hanya perlu kalau item tidak punya bobot sendiri).
    const [p, bobotBawaan] = await Promise.all([ambilProyek(row.proyek_id), row.bobot_tahap ? null : ambilBobotTahap()]);
    if (!bolehProyek(staf, p)) throw new Error("Tidak punya akses ke proyek ini.");
    if (lewatDeadline(p)) throw new Error(`proyek sudah lewat deadline ${tglTh(p.deadline)}, jadi terkunci.`);
    const { portal_progres, ...i } = row;
    const item = { ...i, bobot_tahap: i.bobot_tahap || bobotBawaan?.[i.jenis] || null, ...bacaProgres(portal_progres) };
    const s = tahapItem(item).find((x) => x.k === tahap);
    if (!s) throw new Error("Tahap tidak valid.");
    // Fase berurutan: tahap baru boleh dicatat setelah fase-fase sebelumnya
    // selesai 100%, dan tahap tidak bisa dibatalkan atau diturunkan di bawah
    // 100% selama fase sesudahnya masih punya tahap tercatat (supaya urutan tidak bolong).
    // Foto wajib: tahap hanya boleh dicatat kalau sudah ada minimal 1 foto progres untuk tahap itu.
    if (persen > 0 && s.w > 0 && (await fotoTahap) === 0) throw new Error(`unggah minimal 1 foto untuk tahap ${s.label} dulu.`);
    const penghalang = faseMenghalangi(item, s.fase);
    if (persen > 0 && penghalang) throw new Error(`selesaikan semua tahap ${penghalang.label.toLowerCase()} dulu.`);
    const sesudah = tahapItem(item).filter((x) => FASE.findIndex((f) => f.k === x.fase) > FASE.findIndex((f) => f.k === s.fase) && item.progres[x.k]);
    if (persen < 100 && s.w > 0 && sesudah.length)
      throw new Error(`batalkan dulu tahap ${sesudah.map((x) => x.label).join(", ")} item ini.`);
    // Riwayat perubahan (untuk laporan mingguan); tidak dicatat kalau persennya tidak berubah.
    const riwayat = () =>
      persen !== Number(item.porsi[tahap] ?? 0) &&
      catatRiwayat({ proyekId: row.proyek_id, itemId, tahap, persen, tgl: hariIni(), oleh: staf.id });
    // Simpan progres dan catat riwayat bersamaan (saling tidak bergantung).
    if (!persen) {
      await Promise.all([hasil(db().from("portal_progres").delete().eq("item_id", itemId).eq("tahap", tahap)), riwayat()]);
      return;
    }
    // Tanggal selalu hari ini (tanggal terakhir progres tahap ini diubah).
    const baris = { item_id: itemId, tahap, selesai_tgl: hariIni(), dicatat_oleh: staf.id, dicatat_at: new Date().toISOString() };
    const simpan = async () => {
      try {
        await hasil(db().from("portal_progres").upsert({ ...baris, persen }));
      } catch (e) {
        // Kolom persen belum ada (supabase/add_portal_progres_persen.sql): 100% tetap
        // bisa dicatat seperti dulu; progres sebagian butuh kolomnya.
        if (persen < 100 || !/could not find the 'persen' column|column .*persen.* does not exist/i.test(e.message || "")) throw e;
        await hasil(db().from("portal_progres").upsert(baris));
      }
    };
    await Promise.all([simpan(), riwayat()]);
  }, { admin: false });
}

/* ---------- Foto progres item ---------- */
// Hapus satu foto progres (diunggah lewat app/api/portal/progres-foto). Admin
// dan supervisor; proyek yang sudah terkunci tidak bisa diubah.
export async function hapusFotoProgresItem(id) {
  return jalan(async (staf) => {
    const f = await hasil(db().from("portal_progres_foto").select("*").eq("id", id).maybeSingle());
    if (!f) throw new Error("Foto tidak ditemukan.");
    if (!bolehProyek(staf, await cekTerbuka(f.proyek_id))) throw new Error("Tidak punya akses ke proyek ini.");
    await hapus("portal_progres_foto", id);
    await db().storage.from(BUCKET_PROGRES).remove([f.path]);
  }, { admin: false });
}

// Kaitkan foto progres (mis. foto lama tanpa tahap) ke satu tahap item.
export async function tandaiFotoProgres(id, tahap) {
  return jalan(async (staf) => {
    const f = await hasil(db().from("portal_progres_foto").select("*, item:item_id(jenis)").eq("id", id).maybeSingle());
    if (!f) throw new Error("Foto tidak ditemukan.");
    if (!bolehProyek(staf, await cekTerbuka(f.proyek_id))) throw new Error("Tidak punya akses ke proyek ini.");
    if (!(TAHAP[f.item?.jenis] || TAHAP.HPL).some((s) => s.k === tahap)) throw new Error("Tahap tidak valid.");
    await ubah("portal_progres_foto", id, { tahap });
  }, { admin: false });
}

/* ---------- Item BOQ ---------- */
export async function tambahItem(proyekId, rows) {
  return jalan(async () => {
    await cekTerbuka(proyekId);
    const baru = rows.filter((r) => r.nama).map((r) => ({ ...cekItem(pilih(r, F_ITEM)), proyek_id: proyekId }));
    cekFoto(baru, proyekId);
    if (baru.length) await hasil(db().from("portal_item").insert(baru));
  });
}

export async function ubahItem(id, patch) {
  return jalan(async () => {
    await cekTerbuka(await proyekDari("portal_item", "id", id));
    await ubah("portal_item", id, cekItem(pilih(patch, F_ITEM)));
  });
}

// Ganti seluruh BOQ proyek. Item baru disimpan dulu, baru yang lama dihapus,
// supaya BOQ lama tidak hilang kalau penyimpanan gagal di tengah jalan.
// Progres item lama ikut terhapus (on delete cascade).
export async function gantiItem(proyekId, rows) {
  return jalan(async () => {
    await cekTerbuka(proyekId);
    const baru = rows.filter((r) => r.nama).map((r) => ({ ...cekItem(pilih(r, F_ITEM)), proyek_id: proyekId }));
    if (!baru.length) throw new Error("Tidak ada item pengganti.");
    cekFoto(baru, proyekId);
    const lama = await hasil(db().from("portal_item").select("*").eq("proyek_id", proyekId));
    await hasil(db().from("portal_item").insert(baru));
    await hapusFotoProgres({ itemIds: lama.map((i) => i.id) }); // berkasnya; barisnya ikut terhapus bersama itemnya
    for (let n = 0; n < lama.length; n += 100)
      await hasil(db().from("portal_item").delete().in("id", lama.slice(n, n + 100).map((i) => i.id)));
    await hapusFotoItem(lama.flatMap((i) => i.foto || []));
  });
}

// Isi jasa tukang beberapa item sekaligus (hasil impor Excel Hitungan Jasa
// Pekerjaan; mode Perbarui di impor BOQ, progres tidak tersentuh).
// rows = [{ id, harga_satuan, harga, tim, foto }]; hanya item proyek ini.
export async function simpanJasaTukang(proyekId, rows) {
  return jalan(async () => {
    await cekTerbuka(proyekId);
    const milik = new Set((await hasil(db().from("portal_item").select("id").eq("proyek_id", proyekId))).map((i) => i.id));
    if (rows.some((r) => !milik.has(r.id))) throw new Error("ada item yang bukan milik proyek ini.");
    cekFoto(rows, proyekId);
    for (const r of rows) await ubah("portal_item", r.id, cekItem(pilih(r, ["harga_satuan", "harga", "tim", "foto"])));
  });
}

// Progres item ikut terhapus (on delete cascade).
export async function hapusItem(id) {
  return jalan(async () => {
    await cekTerbuka(await proyekDari("portal_item", "id", id));
    const it = await hasil(db().from("portal_item").select("*").eq("id", id).maybeSingle());
    await hapusFotoProgres({ itemIds: [id] });
    await hapus("portal_item", id);
    await hapusFotoItem(it?.foto);
  });
}

/* ---------- Termin ---------- */
export async function tambahTermin(proyekId, rows) {
  return jalan(async () => {
    await cekTerbuka(proyekId);
    const baru = rows.map((r) => ({ jenis: "produksi", ...cekTermin(pilih(r, F_TERMIN)), proyek_id: proyekId }));
    for (const [jenis] of JENIS_TERMIN) {
      const tambahan = baru.filter((r) => r.jenis === jenis).reduce((a, r) => a + Number(r.persen), 0);
      if (tambahan) await cekTotalTermin(proyekId, jenis, tambahan);
    }
    await hasil(db().from("portal_termin").insert(baru));
  });
}

// Ganti seluruh termin satu jenis dengan pola standar (lihat terminStandar).
// Ditolak kalau sudah ada pembayaran di jenis itu, supaya catatan bayar tidak hilang.
export async function buatTerminStandar(proyekId, jenis) {
  return jalan(async () => {
    if (!JENIS_TERMIN.some(([k]) => k === jenis)) throw new Error("Jenis termin tidak valid.");
    await cekTerbuka(proyekId);
    const lama = await hasil(
      db().from("portal_termin").select("id, lunas_tgl, dibayar").eq("proyek_id", proyekId).eq("jenis", jenis)
    );
    if (lama.some((t) => t.lunas_tgl || Number(t.dibayar) > 0))
      throw new Error("sudah ada pembayaran di termin ini. Ubah persennya satu per satu.");
    await hasil(
      db().from("portal_termin").insert(
        terminStandar().map(([label, persen], n) => ({ proyek_id: proyekId, jenis, urutan: n, label, persen }))
      )
    );
    if (lama.length) await hasil(db().from("portal_termin").delete().in("id", lama.map((t) => t.id)));
  });
}

export async function ubahTermin(id, patch) {
  return jalan(async () => {
    // Jenis termin tidak diubah setelah dibuat.
    const { jenis, ...p } = cekTermin(pilih(patch, F_TERMIN));
    const t = await hasil(db().from("portal_termin").select("*").eq("id", id).maybeSingle());
    if (!t) throw new Error("Termin tidak ditemukan.");
    await cekTerbuka(t.proyek_id);
    if ("persen" in p) await cekTotalTermin(t.proyek_id, t.jenis || "produksi", Number(p.persen), id);
    // Lunas hanya sah dengan foto bukti pembayaran.
    if (p.lunas_tgl && !(("bukti" in p ? p.bukti : t.bukti) || "")) throw new Error("Unggah foto bukti pembayaran dulu.");
    if (p.bukti && !String(p.bukti).startsWith(`${t.proyek_id}/`)) throw new Error("Foto bukti tidak valid.");
    if ("bukti" in p && !p.bukti && t.lunas_tgl && !("lunas_tgl" in p)) throw new Error("Batalkan status lunas dulu.");
    await ubah("portal_termin", id, p);
    // Bukti yang diganti atau dicabut dihapus dari storage.
    if ("bukti" in p && t.bukti && t.bukti !== p.bukti) await hapusFotoItem([t.bukti]);
  });
}

export async function hapusTermin(id) {
  return jalan(async () => {
    await cekTerbuka(await proyekDari("portal_termin", "id", id));
    const t = await hasil(db().from("portal_termin").select("*").eq("id", id).maybeSingle());
    await hapus("portal_termin", id);
    await hapusFotoItem([t?.bukti]);
  });
}

/* ---------- Addons / penambahan biaya ---------- */
const F_ADDON = ["nama", "nilai", "lunas_tgl"];

function cekAddon(r) {
  if ("nama" in r && !String(r.nama || "").trim()) throw new Error("Nama addon wajib.");
  if ("nama" in r) r.nama = r.nama.trim();
  if ("nilai" in r && !(Number(r.nilai) >= 0)) throw new Error("Nilai addon tidak valid.");
  return r;
}

export async function tambahAddon(proyekId, f) {
  return jalan(async () => {
    await cekTerbuka(proyekId);
    await hasil(db().from("portal_addon").insert({ ...cekAddon(pilih(f, F_ADDON)), proyek_id: proyekId }));
  });
}

export async function ubahAddon(id, patch) {
  return jalan(async () => {
    await cekTerbuka(await proyekDari("portal_addon", "id", id));
    await ubah("portal_addon", id, cekAddon(pilih(patch, F_ADDON)));
  });
}

export async function hapusAddon(id) {
  return jalan(async () => {
    await cekTerbuka(await proyekDari("portal_addon", "id", id));
    await hapus("portal_addon", id);
  });
}

/* ---------- Bobot tahap khusus satu item ---------- */
// bobot = { [tahap]: persen } lengkap untuk jenis item itu. Tidak harus
// berjumlah 100: progres item dihitung dari perbandingannya (lihat persenItem).
// null = kembali memakai bobot jenisnya (halaman Bobot tahap / bawaan).
// Admin dan supervisor boleh; bobot per jenis (simpanBobotTahap) tetap admin saja.
export async function simpanBobotItem(itemId, bobot) {
  return jalan(async (staf) => {
    const item = await hasil(db().from("portal_item").select("proyek_id, jenis").eq("id", itemId).maybeSingle());
    if (!item) throw new Error("Item tidak ditemukan.");
    if (!bolehProyek(staf, await cekTerbuka(item.proyek_id))) throw new Error("Tidak punya akses ke proyek ini.");
    let isi = null;
    if (bobot) {
      isi = Object.fromEntries((TAHAP[item.jenis] || TAHAP.HPL).map((s) => [s.k, Number(bobot[s.k])]));
      if (Object.values(isi).some((v) => !(v >= 0 && v <= 100))) throw new Error("tiap tahap harus 0–100%.");
      if (!(Object.values(isi).reduce((a, v) => a + v, 0) > 0)) throw new Error("minimal satu tahap harus punya bobot.");
    }
    await ubah("portal_item", itemId, { bobot_tahap: isi });
  });
}

/* ---------- Bobot tahap (per jenis, semua proyek) ---------- */
// bobot = { [tahap]: persen } lengkap untuk satu jenis, berjumlah 100.
export async function simpanBobotTahap(jenis, bobot) {
  return jalan(async (staf) => {
    const tahap = TAHAP[jenis];
    if (!tahap) throw new Error("Jenis tidak valid.");
    const rows = tahap.map((s) => ({ jenis, tahap: s.k, bobot: Number(bobot?.[s.k]) }));
    if (rows.some((r) => !(r.bobot >= 0 && r.bobot <= 100))) throw new Error("Tiap tahap harus diisi 0–100.");
    const total = rows.reduce((a, r) => a + r.bobot, 0);
    if (Math.abs(total - 100) > 0.001) throw new Error(`Total harus 100%, sekarang ${total}%.`);
    await hasil(
      db().from("portal_bobot_tahap").upsert(rows.map((r) => ({ ...r, diubah_oleh: staf.id, diubah_at: new Date().toISOString() })))
    );
  });
}

// Hapus pengaturan -> jenis ini kembali memakai bobot bawaan.
export async function resetBobotTahap(jenis) {
  return jalan(async () => {
    if (!TAHAP[jenis]) throw new Error("Jenis tidak valid.");
    await hasil(db().from("portal_bobot_tahap").delete().eq("jenis", jenis));
  });
}

/* ---------- Defect dari klien ---------- */
// Defect yang tersambung ke Defect List Aplikasi Mandor (checklist_id) dikelola di sana.
const DI_MANDOR = "defect ini dikelola di Defect List Aplikasi Mandor.";

// Defect hanya untuk supervisor; admin tidak melihat maupun mengubahnya.
const hanyaSpv = (staf) => { if (staf.role === "ADMIN") throw new Error("Defect hanya dikelola supervisor."); };

// Supervisor: ubah status (BARU/DIPROSES/SELESAI) dan tanggapan yang
// tampil di halaman klien. Tidak ikut kunci deadline (keluhan sering datang
// setelah serah terima).
export async function ubahDefect(id, patch) {
  return jalan(async (staf) => {
    hanyaSpv(staf);
    const d = await hasil(db().from("portal_defect").select("*").eq("id", id).maybeSingle());
    if (!d) throw new Error("Defect tidak ditemukan.");
    if (!bolehProyek(staf, await ambilProyek(d.proyek_id))) throw new Error("Tidak punya akses ke proyek ini.");
    if (d.checklist_id) throw new Error(DI_MANDOR);
    const isi = {};
    if ("status" in patch) {
      if (!["BARU", "DIPROSES", "SELESAI"].includes(patch.status)) throw new Error("Status tidak valid.");
      isi.status = patch.status;
    }
    if ("tanggapan" in patch) {
      const t = String(patch.tanggapan || "").trim();
      if (t.length > 1000) throw new Error("tanggapan maksimal 1000 huruf.");
      isi.tanggapan = t || null;
    }
    await ubah("portal_defect", id, { ...isi, diubah_oleh: staf.id, diubah_at: new Date().toISOString() });
  }, { admin: false });
}

// Hapus satu foto tanggapan (diunggah lewat app/api/portal/defect/tanggapan).
export async function hapusFotoTanggapan(id, path) {
  return jalan(async (staf) => {
    hanyaSpv(staf);
    const d = await hasil(db().from("portal_defect").select("*").eq("id", id).maybeSingle());
    if (!d) throw new Error("Defect tidak ditemukan.");
    if (!bolehProyek(staf, await ambilProyek(d.proyek_id))) throw new Error("Tidak punya akses ke proyek ini.");
    if (d.checklist_id) throw new Error(DI_MANDOR);
    if (!(d.foto_tanggapan || []).includes(path)) throw new Error("Foto tidak ditemukan.");
    await ubah("portal_defect", id, {
      foto_tanggapan: d.foto_tanggapan.filter((p) => p !== path), diubah_oleh: staf.id, diubah_at: new Date().toISOString(),
    });
    await db().storage.from(BUCKET_DEFECT).remove([path]);
  }, { admin: false });
}

/* ---------- Link klien ---------- */
// Satu proyek satu link. Link selalu menampilkan data terbaru, jadi tidak perlu
// dibuat ulang; link baru hanya bisa dibuat setelah link lama dihapus.
export async function buatLink(proyekId, nama) {
  return jalan(async () => {
    await cekTerbuka(proyekId);
    const ada = await hasil(db().from("portal_link").select("token").eq("proyek_id", proyekId).limit(1));
    if (ada.length) throw new Error("proyek ini sudah punya link klien. Hapus link lama dulu kalau mau membuat yang baru.");
    const token = randomBytes(32).toString("base64url");
    await hasil(db().from("portal_link").insert({ token, proyek_id: proyekId, nama: nama?.trim() || null }));
    return { token };
  });
}

export async function cabutLink(token) {
  return jalan(async () => {
    await cekTerbuka(await proyekDari("portal_link", "token", token));
    await hasil(db().from("portal_link").delete().eq("token", token));
  });
}
