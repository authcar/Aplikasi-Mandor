import TukangHarianNavbar from "@/components/TukangHarianNavbar";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function TukangHarianLayout({ children }) {
  return (
    <div className="pb-16">
      {children}
      <TukangHarianNavbar />
      <PushNotificationSetup />
    </div>
  );
}
