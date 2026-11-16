import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { SubmitButton } from "@/components/submit-button";
import { Chip, Panel, type Tone } from "@/components/ui";
import { NICHES, type Niche } from "@/leads/classify";
import { googleMapsUrl } from "@/leads/search";
import { nextStep, timelineOf } from "@/leads/timeline";
import { markDoNotContact, prepareDemo } from "../../buscar/actions";
import { requestMessage } from "../../mensajes/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAGE: Record<string, { label: string; tone: Tone }> = {
  found: { label: "Encontrado", tone: "idle" },
  analyzed: { label: "Analizado", tone: "idle" },
  demo_created: { label: "Con demo", tone: "work" },
  contacted: { label: "Contactado", tone: "wait" },
  replied: { label: "Le interesó", tone: "work" },
  closed: { label: "Cliente", tone: "coin" },
  paying: { label: "Cliente", tone: "coin" },
  hosted: { label: "Cliente", tone: "coin" },
  lost: { label: "Perdido", tone: "stuck" },
  do_not_contact: { label: "No contactar", tone: "stuck" },
};
const WEB: Record<string, string> = { none: "Sin web", social_only: "Solo redes o turnos", down: "Web caída", outdated: "Web anticuada", unchecked: "Web sin revisar", ok: "Web moderna" };
const day = (d: Date | null) => (d ? d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "");

// Ficha del negocio (reforma 2026-11-10): todo su recorrido en un solo lugar, de "encontrado" a "cliente".
export default function FichaPage({ params }: PageProps<"/negocios/[id]">) {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <Suspense fallback={<p className="text-(--av-muted)">Cargando…</p>}>
        <Ficha params={params} />
      </Suspense>
    </main>
  );
}

async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connection();
  if (!UUID.test(id)) notFound();
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, id));
  if (!lead) notFound();
  const [[demo], msgs, visits, [client]] = await Promise.all([
    db.select().from(schema.demos).where(eq(schema.demos.leadId, id)).orderBy(desc(schema.demos.createdAt)).limit(1),
    db.select().from(schema.messages).where(eq(schema.messages.leadId, id)).orderBy(desc(schema.messages.createdAt)).limit(5),
    db.select().from(schema.visits).where(eq(schema.visits.leadId, id)).orderBy(desc(schema.visits.visitedAt)).limit(10),
    db.select().from(schema.clients).where(eq(schema.clients.leadId, id)),
  ]);
  const steps = timelineOf({ stage: lead.stage, createdAt: lead.createdAt, webCheckedAt: lead.webCheckedAt, demo: demo ?? null, message: msgs[0] ?? null, visit: visits[0] ?? null, client: client ?? null });
  const now = nextStep(steps, lead.stage);
  const closed = lead.stage === "lost" || lead.stage === "do_not_contact";
  const st = STAGE[lead.stage];
  const liveDemo = demo && demo.status !== "removed" ? demo : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl leading-tight">{lead.name}</h1>
          <p className="text-sm text-(--av-muted)">
            {NICHES[lead.niche as Niche] ?? lead.category ?? "Sin rubro"}
            {lead.address ? ` · ${lead.address}` : ""}
          </p>
        </div>
        <Chip tone={st.tone}>{st.label}</Chip>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Recorrido">
          <ol className="hud-timeline">
            {steps.map((s, i) => (
              <li key={s.label} data-done={s.done ? "" : undefined} data-now={i === now ? "" : undefined}>
                <i />
                <span>
                  <b>{s.label}</b>
                  {s.detail && <span className="text-(--av-muted)"> · {s.detail}</span>}
                </span>
                <small>{s.done || s.detail ? day(s.at) : i === now ? "ahora" : ""}</small>
              </li>
            ))}
          </ol>
          {lead.stage === "lost" && <p className="mt-2 text-sm text-(--av-muted)">Perdido{lead.lostReason ? `: ${lead.lostReason}` : ""}.</p>}
        </Panel>

        <Panel title="Qué hacer ahora">
          <div className="flex flex-wrap gap-2">
            {liveDemo && (
              <>
                <Link href={`/demo/${liveDemo.slug}`} target="_blank" className="av-btn av-btn-coin text-sm">
                  Ver demo
                </Link>
                <Link href={`/demos/${liveDemo.id}`} className="av-btn text-sm">
                  Editar demo
                </Link>
              </>
            )}
            {!liveDemo && !closed && (
              <form action={prepareDemo}>
                <input type="hidden" name="id" value={lead.id} />
                <SubmitButton pendingText="Guardando…" className="av-btn av-btn-coin text-sm">
                  Preparar demo
                </SubmitButton>
              </form>
            )}
            {liveDemo && !closed && lead.phone && !msgs.some((m) => m.status === "pending_approval" || m.status === "approved") && (
              <form action={requestMessage}>
                <input type="hidden" name="leadId" value={lead.id} />
                <SubmitButton pendingText="Pidiendo…" className="av-btn text-sm" title="El Comunicador lo redacta y va a tu bandeja; no se envía nada solo">
                  Pedir mensaje
                </SubmitButton>
              </form>
            )}
            <a href={googleMapsUrl(lead)} target="_blank" rel="noopener noreferrer" className="av-btn text-sm">
              Ver en Google Maps
            </a>
            {msgs.length > 0 && (
              <Link href="/mensajes" className="av-btn text-sm">
                Ir a Mensajes
              </Link>
            )}
            {client && (
              <Link href="/ventas" className="av-btn text-sm">
                Ir a Ventas y cobros
              </Link>
            )}
          </div>
          {!closed && (
            <form action={markDoNotContact} className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-(--av-sunk) pt-3 text-sm">
              <input type="hidden" name="id" value={lead.id} />
              <input name="reason" placeholder="Motivo (opcional)" aria-label="Motivo para no contactar" className="min-w-0 flex-1 p-1.5" />
              <SubmitButton pendingText="Guardando…" className="av-btn text-sm">
                No contactar
              </SubmitButton>
            </form>
          )}
        </Panel>
      </div>

      <Panel title="Datos">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row k="Teléfono" v={lead.phone ?? "sin teléfono"} />
          <Row k="Web" v={`${WEB[lead.webStatus]}${lead.webScore != null ? ` (anticuada ${lead.webScore}/100)` : ""}`} />
          <Row k="Sitios" v={lead.websites.length ? lead.websites.join(", ") : "ninguno"} />
          <Row k="Redes" v={lead.socials.length ? lead.socials.join(", ") : "ninguna"} />
          <Row k="Fuente" v={lead.source === "manual" ? "Cargado a mano" : "Overture Maps"} />
          {client && <Row k="Venta" v={`USD ${client.priceUsd}${client.maintenanceUsd ? ` + mantenimiento USD ${client.maintenanceUsd}` : ""}`} />}
        </dl>
        {lead.notes && <p className="av-sunk mt-3 whitespace-pre-wrap p-3 text-sm">{lead.notes}</p>}
      </Panel>

      {(msgs.length > 0 || visits.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {msgs.length > 0 && (
            <Panel title="Mensajes">
              <ul className="space-y-3 text-sm">
                {msgs.map((m) => (
                  <li key={m.id}>
                    <p className="text-xs text-(--av-muted)">
                      {day(m.createdAt)} · {m.status === "sent" ? "enviado" : m.status === "approved" ? "aprobado, sin mandar" : m.status === "rejected" ? "rechazado" : "espera tu aprobación"}
                    </p>
                    <p className="av-sunk whitespace-pre-wrap p-2">{m.text}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {visits.length > 0 && (
            <Panel title="Visitas">
              <ul className="space-y-2 text-sm">
                {visits.map((v) => (
                  <li key={v.id}>
                    <b>{day(v.visitedAt)}</b>: {v.result === "interested" ? "le interesó" : v.result === "come_back" ? `volver${v.comeBackOn ? ` el ${v.comeBackOn.split("-").reverse().join("/")}` : " otro día"}` : "no le interesa"}
                    {v.note && <p className="text-(--av-muted)">{v.note}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-(--av-muted)">{k}:</dt>
      <dd className="min-w-0 break-words">{v}</dd>
    </div>
  );
}
