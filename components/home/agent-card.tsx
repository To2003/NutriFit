import { ProfeBubble } from "@/components/ui/profe";

export function AgentCard({ text, when }: { text: string; when?: string }) {
  return (
    <section aria-label="Último mensaje del Profe">
      <ProfeBubble footer={when ? <p className="text-xs text-muted">{when}</p> : undefined}>{text}</ProfeBubble>
    </section>
  );
}
