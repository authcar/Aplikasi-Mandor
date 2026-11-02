import MandorNavbar from "@/components/MandorNavbar";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function MandorLayout({ children }) {
  return (
    <div className="pb-24">
      {children}
      <MandorNavbar />
      <PushNotificationSetup />
    </div>
  );
}
