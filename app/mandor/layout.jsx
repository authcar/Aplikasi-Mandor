import MandorNavbar from "@/components/MandorNavbar";

export default function MandorLayout({ children }) {
  return (
    <div className="pb-16">
      {children}
      <MandorNavbar />
    </div>
  );
}
