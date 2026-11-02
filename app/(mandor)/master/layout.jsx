import TopBar from "@/components/TopBar";
import MasterNavbar from "@/components/MasterNavbar";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function MasterLayout({ children }) {
  return (
    <div className="pb-24">
      <TopBar label="Taraco App · Master" />
      {children}
      <MasterNavbar />
      <PushNotificationSetup />
    </div>
  );
}
