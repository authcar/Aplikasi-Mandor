import SupervisorNavbar from "@/components/SupervisorNavbar";

export default function SupervisorLayout({ children }) {
  return (
    <div className="pb-16">
      {children}
      <SupervisorNavbar />
    </div>
  );
}
