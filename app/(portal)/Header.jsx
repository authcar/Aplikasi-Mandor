// `kembali` = tautan ke aplikasi lapangan (hanya untuk staf; klien tidak punya akun).
export default function Header({ kembali = false, label = "Project Tracker" }) {
  return (
    <header className="top">
      <div className="brand">
        <span className="logo" role="img" aria-label="Taraco Interior" />
        <small>{label}</small>
      </div>
      {kembali && <a href="/" className="logout">← Aplikasi</a>}
    </header>
  );
}
