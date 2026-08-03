import MandorNavbar from "@/components/MandorNavbar";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function MandorLayout({ children }) {
  return (
    <div className="pb-16">
      {children}
      <MandorNavbar />
      <PushNotificationSetup />
    </div>
  );
}
