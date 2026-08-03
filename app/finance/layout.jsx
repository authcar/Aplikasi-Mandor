import FinanceNavbar from "@/components/FinanceNavbar";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function FinanceLayout({ children }) {
  return (
    <div className="pb-16">
      {children}
      <FinanceNavbar />
      <PushNotificationSetup />
    </div>
  );
}
