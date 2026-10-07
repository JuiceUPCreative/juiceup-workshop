import { AdminGate } from "@/components/admin/AdminGate";
import { Dashboard } from "@/components/admin/Dashboard";

export default function AdminPage() {
  return (
    <AdminGate>
      <Dashboard />
    </AdminGate>
  );
}
