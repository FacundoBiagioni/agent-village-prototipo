import { Suspense } from "react";
import { agents } from "@/agents";
import { approvalText } from "@/runtime/approval-text";
import { getPendingApprovals, getQueue } from "@/lib/dashboard";
import { Chip, Panel } from "@/components/ui";
import { decide } from "../actions";

// Qué se aprueba, en palabras (el detalle lo arma approvalText).
const ACTION: Record<string, string> = { whatsapp_message: "Mensaje de WhatsApp", publish_demo: "Publicar una demo", install_skill: "Instalar una skill", publish_site: "Publicar el sitio de un cliente", pause_site: "Pausar el sitio de un cliente" };
const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id;
const taskLabel = (agentId: string, taskType: string) => agents.find((a) => a.id === agentId)?.tasks[taskType]?.label ?? taskType;
const approx = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60_000)} min`);

// Bandeja de aprobación (menú del buzón): nada sale hacia afuera sin un clic acá.
export default function BandejaPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Suspense fallback={<Panel title="Bandeja">Cargando…</Panel>}>
        <Inbox />
      </Suspense>
      <Suspense fallback={null}>
        <Queue />
      </Suspense>
    </main>
  );
}

async function Inbox() {
  const pending = await getPendingApprovals();
  return (
    <Panel title="Bandeja" tone={pending.length ? "wait" : undefined} aside={pending.length > 0 && <Chip tone="wait">{pending.length} esperan tu OK</Chip>}>
      {pending.length === 0 && <p className="text-sm text-(--av-muted)">Nada espera tu aprobación. Lo que un agente quiera hacer hacia afuera aparece acá y en Telegram.</p>}
      <ul className="space-y-3">
        {pending.map((a) => (
          <li key={a.id} className="av-sunk p-3">
            <p className="text-sm">
              <span className="av-title">{ACTION[a.actionType] ?? a.actionType}</span>
              <span className="text-(--av-muted)"> · lo pide {agentName(a.agentId)}</span>
            </p>
            <p className="my-2 max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-sm">{approvalText(a.actionType, a.payload)}</p>
            <form action={decide} className="flex gap-2">
              <input type="hidden" name="id" value={a.id} />
              <button name="decision" value="approved" className="av-btn av-btn-coin flex-1">
                Aprobar
              </button>
              <button name="decision" value="rejected" className="av-btn flex-1">
                Rechazar
              </button>
            </form>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

async function Queue() {
  const queue = await getQueue();
  if (queue.length === 0) return null;
  return (
    <Panel title={`En cola (${queue.length})`}>
      <ul className="space-y-1.5 text-sm">
        {queue.map(({ run, startsInMs }) => (
          <li key={run.id} className="flex justify-between gap-3">
            <span>
              <span className="font-medium">{agentName(run.agentId)}</span> · {taskLabel(run.agentId, run.taskType)}
            </span>
            <span className="shrink-0 text-(--av-muted)">{startsInMs == null ? "sin estimado" : startsInMs === 0 ? "ahora" : `en ~${approx(startsInMs)}`}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
