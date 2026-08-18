import "./globals.css";

export const metadata = {
  title: "Taraco App",
  description: "Manajemen proyek lapangan untuk Mandor & Supervisor",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Taraco",
  },
  icons: {
    // `icon` WAJIB disebut di sini: begitu metadata.icons diisi, Next berhenti
    // memakai konvensi file app/icon.svg, jadi tanpa baris ini tab browser
    // tidak dapat <link rel="icon"> sama sekali (dan /favicon.ico 404).
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
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
        <div className="relative mx-auto min-h-screen max-w-md bg-slate-50 shadow-soft sm:my-0">
          {children}
        </div>
      </body>
    </html>
  );
}
