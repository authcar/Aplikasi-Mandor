import TopBar from "@/components/TopBar";
import TukangHarianNavbar from "@/components/TukangHarianNavbar";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function TukangHarianLayout({ children }) {
  return (
    <div className="pb-24">
      <TopBar label="Taraco App · Tukang Harian" />
      {children}
      <TukangHarianNavbar />
      <PushNotificationSetup />
    </div>
  );
}
