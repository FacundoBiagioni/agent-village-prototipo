import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { db, schema } from "@/db";
import { waUrl } from "@/messages/content";
import { LOSS_REASONS } from "@/metrics/metrics";
import { SubmitButton } from "@/components/submit-button";
import { Chip, PageHeader, Panel, type Tone } from "@/components/ui";
import { markOutcome, markSent } from "./actions";

type Row = Awaited<ReturnType<typeof load>>[number];

// Grupos en el orden en que importan: lo que podés mandar ya, lo que espera tu OK, lo enviado y lo rechazado.
const GROUPS: { status: string; title: string; tone: Tone; open: boolean; empty?: string }[] = [
  { status: "approved", title: "Listos para mandar", tone: "coin", open: true },
  { status: "pending_approval", title: "Esperan tu aprobación", tone: "wait", open: true },
  { status: "sent", title: "Enviados", tone: "work", open: true },
  { status: "rejected", title: "Rechazados", tone: "idle", open: false },
];

export default function MensajesPage() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeader title="Mensajes" />
      <p className="mb-5 text-sm text-(--av-muted)">El sistema nunca envía nada: al aprobar un mensaje aparece el botón para abrirlo en tu WhatsApp, y lo mandás vos.</p>
      <Suspense fallback={<p className="text-(--av-muted)">Cargando…</p>}>
        <MessageList />
      </Suspense>
    </main>
  );
}

const load = () =>
  db
    .select({ id: schema.messages.id, channel: schema.messages.channel, text: schema.messages.text, phone: schema.messages.phone, status: schema.messages.status, createdAt: schema.messages.createdAt, name: schema.leads.name, leadId: schema.leads.id, stage: schema.leads.stage, lostReason: schema.leads.lostReason })
    .from(schema.messages)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.messages.leadId))
    .orderBy(desc(schema.messages.createdAt));

async function MessageList() {
  await connection();
  const rows = await load();
  if (rows.length === 0)
    return <p className="av-panel p-4 text-sm text-(--av-muted)">Todavía no hay mensajes. En Demos, tocá &quot;Publicar y preparar mensaje&quot; o &quot;Preparar mensaje&quot;.</p>;
  const active = rows.some((r) => r.status !== "rejected");
  return (
    <div className="space-y-6">
      {!active && <p className="av-panel p-4 text-sm text-(--av-muted)">No hay mensajes para mandar ni esperando tu aprobación. En Demos, tocá &quot;Publicar y preparar mensaje&quot;.</p>}
      {GROUPS.map((g) => {
        const list = rows.filter((r) => r.status === g.status);
        if (list.length === 0) return null;
        return (
          <Panel key={g.status} title={`${g.title} (${list.length})`} tone={g.status === "rejected" ? undefined : g.tone} collapsible defaultOpen={g.open}>
            <ul className="space-y-4">
              {list.map((m) => (
                <Message key={m.id} m={m} />
              ))}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}

function Message({ m }: { m: Row }) {
  const outcome = m.stage === "replied" ? <Chip tone="work">Le interesó</Chip> : m.stage === "lost" ? <Chip tone="stuck">Perdido</Chip> : null;
  return (
    <li className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/negocios/${m.leadId}`} className="av-title hover:underline" title="Abrir la ficha del negocio">
          {m.name}
        </Link>
        <span className="flex items-center gap-2 text-xs text-(--av-muted)">
          {outcome}
          {m.channel === "cobro" && <Chip tone="wait">Cobro</Chip>}
          {m.createdAt.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} · +{m.phone}
        </span>
      </div>
      {/* El texto como globo de chat: así se va a ver en el WhatsApp del negocio. */}
      <p className="av-sunk max-w-prose whitespace-pre-wrap rounded-tl-sm p-3 text-sm">{m.text}</p>
      {m.status === "approved" && (
        <div className="flex flex-wrap items-center gap-2">
          <a href={waUrl(m.phone, m.text)} target="_blank" rel="noopener noreferrer" className="av-btn av-btn-coin text-sm">
            Abrir WhatsApp
          </a>
          <form action={markSent}>
            <input type="hidden" name="id" value={m.id} />
            <SubmitButton pendingText="Guardando…" className="av-btn text-sm" title="Marcalo después de mandarlo: cuenta como contacto en Métricas">
              Ya lo envié
            </SubmitButton>
          </form>
        </div>
      )}
      {m.status === "sent" && m.stage === "contacted" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <form action={markOutcome}>
            <input type="hidden" name="leadId" value={m.leadId} />
            <SubmitButton name="outcome" value="replied" pendingText="Guardando…" className="av-btn text-sm">
              Le interesó
            </SubmitButton>
          </form>
          <LostForm m={m} />
        </div>
      )}
      {m.status === "sent" && m.stage === "replied" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <LostForm m={m} />
        </div>
      )}
      {m.status === "sent" && m.stage === "lost" && <p className="text-sm text-(--av-muted)">Motivo: {m.lostReason}</p>}
    </li>
  );
}

function LostForm({ m }: { m: Row }) {
  return (
    <form action={markOutcome} className="flex items-center gap-2">
      <input type="hidden" name="leadId" value={m.leadId} />
      <label className="sr-only" htmlFor={`reason-${m.id}`}>
        Motivo
      </label>
      <select id={`reason-${m.id}`} name="reason" className="px-2 py-1.5 text-sm">
        {LOSS_REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <SubmitButton name="outcome" value="lost" pendingText="Guardando…" className="av-btn text-sm">
        Perdido
      </SubmitButton>
    </form>
  );
}
