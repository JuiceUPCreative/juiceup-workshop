import { Suspense } from "react";
import { Loader } from "@/components/Logo";
import { Quiz } from "@/components/Quiz";

export default function Page({ params }: PageProps<"/s/[code]">) {
  return (
    <Suspense fallback={<Loader />}>
      <Quiz params={params} />
    </Suspense>
  );
}
