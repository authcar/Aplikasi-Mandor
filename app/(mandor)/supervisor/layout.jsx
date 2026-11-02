import TopBar from "@/components/TopBar";
import SupervisorNavbar from "@/components/SupervisorNavbar";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function SupervisorLayout({ children }) {
  return (
    <div className="pb-24">
      <TopBar label="Taraco App · Supervisor" />
      {children}
      <SupervisorNavbar />
      <PushNotificationSetup />
    </div>
  );
}
