import { Suspense } from "react";
import { NewReservationFlow } from "./NewReservationFlow";

export default function NewReservationPage() {
  return (
    <Suspense fallback={null}>
      <NewReservationFlow />
    </Suspense>
  );
}
