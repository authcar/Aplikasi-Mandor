import Icon from "@/components/Icon";

// Tile "level terkunci" — dipakai buat fitur yang belum di-rollout.
// Sengaja bukan <Link>: tidak bisa ditap/dinavigasi sama sekali.
export default function LockedTile({ label, gap = "gap-1.5" }) {
  return (
    <div
      className={`relative flex flex-col items-center ${gap} opacity-50`}
      aria-disabled="true"
      title="Belum tersedia"
    >
      <span className="icon-tile !rounded-full bg-gray-100 text-gray-400">
        <Icon name="lock" />
      </span>
      <span className="text-[11px] font-semibold text-gray-400 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}
