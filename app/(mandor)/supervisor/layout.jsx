import SupervisorNavbar from "@/components/SupervisorNavbar";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function SupervisorLayout({ children }) {
  return (
    <div className="pb-16">
      {children}
      <SupervisorNavbar />
      <PushNotificationSetup />
    </div>
  );
}
