import TukangHarianNavbar from "@/components/TukangHarianNavbar";

export default function TukangHarianLayout({ children }) {
  return (
    <div className="pb-16">
      {children}
      <TukangHarianNavbar />
    </div>
  );
}
