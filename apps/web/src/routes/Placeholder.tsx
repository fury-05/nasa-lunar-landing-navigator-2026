import { Chip } from "../components/Chip";
import { Glass } from "../components/Glass";

export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <Glass>
      <h1 className="m-0 text-3xl">{title}</h1>
      <p className="mt-3 text-muted">
        This view is built in {phase}. Nothing here is real data yet.
      </p>
      <Chip tone="warn" className="mt-4">
        pending-source
      </Chip>
    </Glass>
  );
}
