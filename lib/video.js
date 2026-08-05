// Blob hasil MediaRecorder (webm) sering tidak punya durasi valid di
// header-nya (kebaca "Infinity") — browser jadi gak tahu frame mana yang
// harus ditampilkan duluan, hasilnya layar hitam polos walau videonya
// sendiri valid. Bug ini ikut kebawa sampai video-nya sudah diupload &
// diputar ulang lewat FotoLightbox, karena bytes-nya tidak berubah.
// Trik standar: loncat ke waktu yang sangat jauh lalu balik ke 0, supaya
// browser hitung ulang durasi & seekable range-nya. Pakai sebagai
// onLoadedMetadata di elemen <video>.
export function perbaikiDurasiVideo(e) {
  const v = e.currentTarget;
  if (v.duration === Infinity || Number.isNaN(v.duration)) {
    const keAwal = () => {
      v.currentTime = 0;
      v.removeEventListener("timeupdate", keAwal);
    };
    v.addEventListener("timeupdate", keAwal);
    v.currentTime = 1e101;
  }
}
