import { AuthGate } from "@/app/components/auth/AuthGate";
import { PlannerWorkspace } from "@/app/components/PlannerWorkspace";
import { mardDefaultInput } from "@/lib/planner";

export default function WorkspacePage() {
  return (
    <AuthGate>
      <PlannerWorkspace initialInput={mardDefaultInput} />
    </AuthGate>
  );
}
