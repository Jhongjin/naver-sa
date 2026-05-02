import { PlannerWorkspace } from "@/app/components/PlannerWorkspace";
import { mardDefaultInput } from "@/lib/planner";

export default function Home() {
  return <PlannerWorkspace initialInput={mardDefaultInput} />;
}
