import TopBar from "@/components/TopBar";
import MandorNavbar from "@/components/MandorNavbar";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function MandorLayout({ children }) {
  return (
    <div className="pb-24">
      <TopBar label="Taraco App · Mandor" />
      {children}
      <MandorNavbar />
      <PushNotificationSetup />
    </div>
  );
}
