// Header gelap berlogo di atas tiap area peran — sama dengan header Project Tracker
// (.top di app/(portal)/portal.css). Statis (tanpa query), jadi tidak menambah beban halaman.
export default function TopBar({ label }) {
  return (
    <header className="topbar">
      <span className="topbar-logo" role="img" aria-label="Taraco Interior" />
      <small>{label}</small>
    </header>
  );
}
