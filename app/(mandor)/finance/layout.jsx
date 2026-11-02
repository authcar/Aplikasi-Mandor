import TopBar from "@/components/TopBar";
import FinanceNavbar from "@/components/FinanceNavbar";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function FinanceLayout({ children }) {
  return (
    <div className="pb-24">
      <TopBar label="Taraco App · Finance" />
      {children}
      <FinanceNavbar />
      <PushNotificationSetup />
    </div>
  );
}
