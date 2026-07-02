import MasterNavbar from "@/components/MasterNavbar";

export default function MasterLayout({ children }) {
  return (
    <div className="pb-16">
      {children}
      <MasterNavbar />
    </div>
  );
}
