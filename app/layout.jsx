import "./globals.css";

export const metadata = {
  title: "Aplikasi Mandor",
  description: "Manajemen proyek lapangan untuk Mandor & Supervisor",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <div className="mx-auto min-h-screen max-w-md bg-slate-50 shadow-soft sm:my-0">
          {children}
        </div>
      </body>
    </html>
  );
}
