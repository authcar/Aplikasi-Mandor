import { ambilProyekKlien } from "@/lib/portal/server";
import Header from "../../Header";
import Detail from "./Detail";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

// Halaman klien: dibuka lewat link rahasia dari admin, tanpa login.
export default async function ProyekKlien({ params }) {
  const P = await ambilProyekKlien(params.token);
  return (
    <>
      <Header />
      {P ? (
        <Detail P={P} />
      ) : (
        <main className="wrap" style={{ maxWidth: 440 }}>
          <h1>Link tidak berlaku</h1>
          <p className="small">Link ini salah atau sudah dicabut. Hubungi tim Taraco untuk meminta link terbaru.</p>
        </main>
      )}
    </>
  );
}
