self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  // SETIAP push wajib berakhir dengan showNotification(). iOS menegakkan aturan
  // ini keras-keras: push yang tidak memunculkan notifikasi dihitung sebagai
  // pelanggaran, dan setelah beberapa kali Safari mencabut subscription-nya
  // diam-diam — notifikasi berikutnya tidak akan sampai lagi sampai user
  // mendaftar ulang. Jadi payload kosong/rusak pun tetap ditampilkan, dengan
  // teks umum, bukan di-return begitu saja.
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const {
    title = "Taraco App",
    body = "Ada pembaruan baru. Buka aplikasi untuk melihat.",
    url = "/",
  } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      // PNG, bukan SVG: sebagian browser Android tidak merender ikon SVG di
      // notifikasi dan berakhir tanpa ikon sama sekali. iOS mengabaikan opsi
      // ini dan selalu memakai ikon app-nya.
      icon: "/apple-touch-icon.png",
      badge: "/favicon.png",
      // vibrate & actions diabaikan iOS — dibiarkan untuk Android.
      vibrate: [200, 100, 200],
      data: { url },
      actions: [{ action: "lihat", title: "Lihat" }],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
