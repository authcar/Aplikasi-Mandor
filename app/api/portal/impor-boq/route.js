import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db, hasil, UUID } from "@/lib/portal/db";
import { ambilProyek } from "@/lib/portal/data";
import { BUCKET_ITEM } from "@/lib/portal/fotoItem";
import { tambahItemProyek, gantiItemProyek, gantiItemPilihan } from "@/lib/portal/itemProyek";
import { anggotaDariToken, pastikanProyekTaraco, dorongProgres, dorongProgresKetat, lepasTautanTaraco, proyekKartu } from "@/lib/portal/tautTaraco";
import { hapusSatuProyek } from "@/lib/portal/hapusProyek";

export const dynamic = "force-dynamic";

// Impor BoQ dari website Taraco Project Management. Website itu hanya punya
// session Supabase Taraco, jadi pemanggilnya dikenali lewat access token-nya
// (Authorization: Bearer ...), bukan cookie; hanya MASTER / SALES Taraco yang aktif.
//
//   POST application/json  { aksi: "siapkan", taraco_id }
//        -> { proyek_id, baru, nama, jumlah_item }   proyek tracker dibuat / ditautkan
//   POST application/json  { aksi: "kandidat" }                  -> { proyek: [...] } yang belum tertaut
//   POST application/json  { aksi: "tautkan", proyek_id, taraco_id } -> { ok, progres, peringatan? }
//   POST application/json  { aksi: "hapus", taraco_id }           -> { ok, ada }  BoQ + proyek tracker dihapus
//   POST multipart         proyek_id, foto
//        -> { path }                                 satu foto item (gambar kolom C)
//   POST application/json  { aksi: "daftar", taraco_id }
//        -> { items }                                item yang sudah ada (untuk checklist ganti)
//   POST application/json  { aksi: "simpan", proyek_id, items, mode: "tambah" | "ganti" | "ganti_pilih", ganti_ids? }
//        -> { ok, jumlah }                           item disimpan, progres didorong ke Taraco
//
// Bearer token (bukan cookie) -> CORS "*" tidak membuka celah CSRF.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};
const balas = (data, status = 200) => NextResponse.json(data, { status, headers: CORS });
const gagal = (error, status = 400) => balas({ error }, status);

const MAKS_BYTE = 4 * 1024 * 1024; // foto sudah dikecilkan di browser
const MAKS_ITEM = 2000;

export const OPTIONS = () => new NextResponse(null, { status: 204, headers: CORS });

// Proyek tracker yang boleh diisi lewat jalur ini: harus tertaut ke proyek Taraco.
async function proyekTertaut(id) {
  if (!UUID.test(id || "")) return null;
  const p = await ambilProyek(id);
  return p?.taraco_id ? p : null;
}

export async function POST(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  let anggota;
  try {
    anggota = await anggotaDariToken(token);
  } catch {
    return gagal("tidak bisa memeriksa akun Taraco.", 503);
  }
  if (!anggota) return gagal("hanya Master / Sales Taraco yang boleh mengunggah BoQ.", 403);

  try {
    if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form = await req.formData();
      const proyekId = String(form.get("proyek_id") || "");
      const foto = form.get("foto");
      if (!(await proyekTertaut(proyekId))) return gagal("proyek tidak ditemukan.", 404);
      if (!foto || typeof foto !== "object" || !(foto.size > 0)) return gagal("pilih fotonya dulu.");
      if (!String(foto.type).startsWith("image/")) return gagal("lampiran harus berupa foto.");
      if (foto.size > MAKS_BYTE) return gagal("ukuran foto terlalu besar.");
      const ext = foto.type === "image/png" ? "png" : "jpg";
      const path = `${proyekId}/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
      const { error } = await db().storage.from(BUCKET_ITEM).upload(path, Buffer.from(await foto.arrayBuffer()), { contentType: foto.type });
      if (error) {
        if (/bucket not found/i.test(error.message)) return gagal("jalankan supabase/add_portal_item_foto.sql di Supabase dulu.", 503);
        return gagal(`foto gagal diunggah (${error.message}).`, 500);
      }
      return balas({ path });
    }

    const b = await req.json().catch(() => null);
    if (!b) return gagal("data tidak terbaca.");

    if (b.aksi === "siapkan") {
      if (!UUID.test(b.taraco_id || "")) return gagal("proyek tidak valid.");
      const p = await pastikanProyekTaraco(b.taraco_id);
      return balas({ proyek_id: p.id, baru: p.baru, nama: p.nama, jumlah_item: p.jumlahItem });
    }

    // Item yang sudah ada di proyek tracker kartu ini; tidak membuat / menautkan apa pun.
    if (b.aksi === "daftar") {
      if (!UUID.test(b.taraco_id || "")) return gagal("proyek tidak valid.");
      const p = await proyekKartu(b.taraco_id);
      if (!p) return balas({ items: [] });
      // select("*"): kolom hanya_jasa belum tentu sudah ada di database
      const rows = await hasil(db().from("portal_item").select("*").eq("proyek_id", p.id).order("urutan"));
      return balas({
        items: rows.map(({ id, area, kode, nama, qty, satuan, dimensi, urutan, hanya_jasa }) => ({ id, area, kode, nama, qty, satuan, dimensi, urutan, hanya_jasa })),
      });
    }

    // Semua proyek tracker + kartu Taraco yang sudah menerima progresnya
    // -> { proyek: [{ id, nama, kode, taraco_id }], tambahan: [{ proyek_id, taraco_id }] }
    if (b.aksi === "kandidat") {
      const { data, error } = await db().from("portal_proyek").select("id, nama, kode, taraco_id");
      if (error) return gagal("daftar proyek tracker tidak terbaca.", 500);
      const { data: tambahan } = await db().from("portal_taraco_tambahan").select("proyek_id, taraco_id");
      return balas({ proyek: data || [], tambahan: tambahan || [] });
    }

    // Tautkan proyek tracker ke kartu Taraco (dikonfirmasi manual di Taraco), lalu dorong progresnya.
    // Kartu pertama jadi kartu utama (taraco_id); kartu berikutnya dicatat sebagai tambahan.
    if (b.aksi === "tautkan") {
      if (!UUID.test(b.proyek_id || "") || !UUID.test(b.taraco_id || "")) return gagal("data tidak valid.");
      const { data: ada } = await db().from("portal_proyek").select("id, taraco_id").eq("id", b.proyek_id).maybeSingle();
      if (!ada) return gagal("proyek tracker tidak ditemukan.", 404);
      if (ada.taraco_id === b.taraco_id) return gagal("kartu ini sudah tertaut.", 409);
      const { data: dipakai } = await db().from("portal_proyek").select("id").eq("taraco_id", b.taraco_id).maybeSingle();
      if (dipakai) return gagal("kartu Taraco ini sudah tertaut ke proyek tracker lain.", 409);
      if (!ada.taraco_id) {
        const { error } = await db().from("portal_proyek").update({ taraco_id: b.taraco_id }).eq("id", b.proyek_id).is("taraco_id", null);
        if (error) return gagal(`gagal menautkan (${error.message}).`, 500);
      } else {
        const { error } = await db().from("portal_taraco_tambahan").upsert({ taraco_id: b.taraco_id, proyek_id: b.proyek_id });
        if (error) {
          if (/portal_taraco_tambahan|does not exist|schema cache/i.test(error.message))
            return gagal("jalankan supabase/add_portal_taraco_tambahan.sql di Supabase Tracker dulu.", 503);
          return gagal(`gagal menautkan (${error.message}).`, 500);
        }
      }
      try {
        const r = await dorongProgresKetat(b.proyek_id);
        return balas({ ok: true, progres: r ? r.persen : null, item: r ? r.n : null });
      } catch (e) {
        return balas({ ok: true, progres: null, peringatan: e.message });
      }
    }

    // Hapus BoQ dari kartu Taraco ini: proyek tracker-nya ikut terhapus (item, progres, foto),
    // termasuk kalau kartu ini hanya "tambahan" di proyek bersama. Progres di semua kartunya dikosongkan.
    // -> { ok, ada }
    if (b.aksi === "hapus") {
      if (!UUID.test(b.taraco_id || "")) return gagal("proyek tidak valid.");
      const utama = await hasil(db().from("portal_proyek").select("id").eq("taraco_id", b.taraco_id));
      // Tabel tambahan opsional: belum dibuat -> `data` kosong.
      const { data: tambahan } = await db().from("portal_taraco_tambahan").select("proyek_id").eq("taraco_id", b.taraco_id);
      const ids = [...new Set([...utama.map((p) => p.id), ...(tambahan || []).map((r) => r.proyek_id)])];
      for (const id of ids) await hapusSatuProyek(id);
      if (!ids.length) await lepasTautanTaraco(b.taraco_id);
      return balas({ ok: true, ada: ids.length > 0 });
    }

    if (b.aksi === "simpan") {
      if (!(await proyekTertaut(b.proyek_id))) return gagal("proyek tidak ditemukan.", 404);
      if (!Array.isArray(b.items) || !b.items.length) return gagal("tidak ada item untuk disimpan.");
      if (b.items.length > MAKS_ITEM) return gagal(`terlalu banyak item (maksimal ${MAKS_ITEM}).`);
      const items = b.items.filter((i) => i && typeof i === "object");
      if (b.mode === "ganti") await gantiItemProyek(b.proyek_id, items);
      else if (b.mode === "ganti_pilih")
        await gantiItemPilihan(b.proyek_id, Array.isArray(b.ganti_ids) ? b.ganti_ids.filter((id) => UUID.test(id)) : [], items);
      else await tambahItemProyek(b.proyek_id, items);
      await dorongProgres(b.proyek_id);
      return balas({ ok: true, jumlah: items.length });
    }

    return gagal("aksi tidak dikenal.");
  } catch (e) {
    if (/could not find the '\w+' column|column .* does not exist/i.test(e.message || ""))
      return gagal("kolom di database belum lengkap: jalankan file SQL add_portal_*.sql di Supabase dulu.", 503);
    return gagal(e.message || "Terjadi kesalahan.", 500);
  }
}
