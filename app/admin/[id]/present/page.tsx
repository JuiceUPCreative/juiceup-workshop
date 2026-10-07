import { Suspense } from "react";
import { AdminGate } from "@/components/admin/AdminGate";
import { Present } from "@/components/admin/Present";
import { Loader } from "@/components/Logo";

export default function Page({ params }: PageProps<"/admin/[id]/present">) {
  return (
    <AdminGate bare>
      <Suspense fallback={<Loader />}>
        <Present params={params} />
      </Suspense>
    </AdminGate>
  );
}
