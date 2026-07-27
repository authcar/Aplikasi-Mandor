import FinanceNavbar from "@/components/FinanceNavbar";

export default function FinanceLayout({ children }) {
  return (
    <div className="pb-16">
      {children}
      <FinanceNavbar />
    </div>
  );
}
