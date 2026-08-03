import MasterNavbar from "@/components/MasterNavbar";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function MasterLayout({ children }) {
  return (
    <div className="pb-16">
      {children}
      <MasterNavbar />
      <PushNotificationSetup />
    </div>
  );
}
