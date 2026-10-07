import { Suspense } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { SessionAdmin } from "@/components/admin/SessionAdmin";
import { Loader } from "@/components/Logo";

export default function Page({ params }: PageProps<"/admin/[id]">) {
  return (
    <AdminGate>
      <Suspense fallback={<Loader />}>
        <SessionAdmin params={params} />
      </Suspense>
    </AdminGate>
  );
}
