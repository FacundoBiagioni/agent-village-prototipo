import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { db, schema } from "@/db";
import { DIRECTIONS, directionOf } from "@/demos/directions";
import { NICHES, type Niche } from "@/leads/classify";
import { SubmitButton } from "@/components/submit-button";
import { Chip, PageHeader, type Tone } from "@/components/ui";
import { requestMessage } from "../mensajes/actions";
import { requestPublish } from "./actions";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Borrador, solo en tu PC", tone: "idle" },
  approved: { label: "Aprobada", tone: "wait" },
  published: { label: "Publicada", tone: "work" },
  expired: { label: "Vencida", tone: "stuck" },
  removed: { label: "Retirada", tone: "idle" },
};

export default function DemosPage() {
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader title="Demos" />
      <Suspense fallback={<p className="text-(--av-muted)">Cargando…</p>}>
        <DemoList />
      </Suspense>
    </main>
  );
}

async function DemoList() {
  await connection();
  const rows = await db
    .select({ id: schema.demos.id, leadId: schema.demos.leadId, slug: schema.demos.slug, template: schema.demos.template, status: schema.demos.status, createdAt: schema.demos.createdAt, expiresAt: schema.demos.expiresAt, name: schema.leads.name, niche: schema.leads.niche, design: sql<string | null>`${schema.demos.content}->>'design'` })
    .from(schema.demos)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.demos.leadId))
    .orderBy(desc(schema.demos.createdAt));
  if (rows.length === 0)
    return (
      <p className="av-panel p-4 text-(--av-muted)">
        Todavía no hay demos. En <Link href="/buscar" className="font-medium text-(--av-ink) underline">Buscar</Link> elegí un negocio y tocá &quot;Preparar demo&quot;.
      </p>
    );
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {rows.map((d) => {
        const st = STATUS[d.status];
        return (
          <li key={d.slug} className="av-panel flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg leading-tight">
                <Link href={`/negocios/${d.leadId}`} className="hover:underline" title="Abrir la ficha del negocio">
                  {d.name}
                </Link>
              </h2>
              <Chip tone={st.tone}>{st.label}</Chip>
            </div>
            <p className="text-sm text-(--av-muted)">
              {NICHES[d.niche as Niche] ?? "Sin rubro"} · {d.design === "opus" ? "Versión de Opus" : DIRECTIONS[directionOf(d.template)].label} · vence el {d.expiresAt.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
            </p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Link href={`/demo/${d.slug}`} target="_blank" className="av-btn av-btn-coin text-sm">
                Ver demo
              </Link>
              <Link href={`/demos/${d.id}`} className="av-btn text-sm">
                Editar
              </Link>
              {d.status === "draft" ? (
                // Lo habitual: publicar y dejar el mensaje listo, con una sola aprobación. "Solo publicar" queda para cuando no hay WhatsApp.
                <form action={requestPublish} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={d.id} />
                  <SubmitButton name="withMessage" value="1" pendingText="Pidiendo…" className="av-btn text-sm" title="Una sola aprobación en la bandeja: sube la demo y deja el mensaje de WhatsApp listo para que lo mandes vos">
                    Publicar y preparar mensaje
                  </SubmitButton>
                  <SubmitButton name="withMessage" value="0" pendingText="Pidiendo…" className="av-btn text-sm" title="Va a tu bandeja de aprobación; sin tu OK no se publica">
                    Solo publicar
                  </SubmitButton>
                </form>
              ) : (
                <form action={requestMessage}>
                  <input type="hidden" name="leadId" value={d.leadId} />
                  <SubmitButton pendingText="Pidiendo…" className="av-btn text-sm" title="El Comunicador lo redacta y va a tu bandeja; no se envía nada">
                    Preparar mensaje
                  </SubmitButton>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
