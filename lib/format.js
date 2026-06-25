export const rupiah = (n) =>
  "Rp " + Number(n || 0).toLocaleString("id-ID");

export const tglID = (d) =>
  new Date(d).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
