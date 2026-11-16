import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { db, schema } from "@/db";
import { todayAR } from "@/visits/plan";
import { Chip, PageHeader, Panel, type Tone } from "@/components/ui";

const RESULT: Record<string, string> = { interested: "Le interesó", come_back: "Volver otro día", not_interested: "No le interesa" };
const RESULT_TONE: Record<string, Tone> = { interested: "work", come_back: "wait", not_interested: "idle" };

export default function VisitasPage() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeader title="Visitas">
        {/* Página sola (public/visita.html): sin React, para que abra sin internet en el celular. */}
        <a href="/visita.html" className="av-btn av-btn-coin text-sm">
          Ruta del día (celular)
        </a>
      </PageHeader>
      <Suspense fallback={<p className="text-(--av-muted)">Cargando…</p>}>
        <VisitList />
      </Suspense>
    </main>
  );
}

const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

async function VisitList() {
  await connection();
  const rows = await db
    .select({ v: schema.visits, name: schema.leads.name, address: schema.leads.address, stage: schema.leads.stage, slug: schema.demos.slug })
    .from(schema.visits)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.visits.leadId))
    .leftJoin(schema.demos, eq(schema.demos.id, schema.visits.demoId))
    .orderBy(desc(schema.visits.visitedAt))
    .limit(200);
  if (rows.length === 0) return <p className="av-panel p-4 text-sm text-(--av-muted)">Todavía no hay visitas. Se anotan en el celular desde la ruta del día y se suben solas al volver al Wi-Fi de casa.</p>;

  // Para volver: la última visita de cada negocio, si fue "volver otro día" y el negocio no se cerró ni se perdió.
  const today = todayAR();
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.v.leadId)) latest.set(r.v.leadId, r);
  const comeBack = [...latest.values()]
    .filter((r) => r.v.result === "come_back" && !["lost", "do_not_contact", "closed", "paying", "hosted"].includes(r.stage))
    .sort((a, b) => (a.v.comeBackOn ?? "9999").localeCompare(b.v.comeBackOn ?? "9999"));

  return (
    <div className="space-y-6">
      {comeBack.length > 0 && (
        <Panel title={`Para volver (${comeBack.length})`} tone="wait">
          <ul className="divide-y-2 divide-(--av-sunk)">
            {comeBack.map((r) => {
              const d = r.v.comeBackOn;
              const when = !d ? "sin fecha" : d < today ? `se pasó: era el ${fmtDay(d)}` : d === today ? "hoy" : fmtDay(d);
              return (
                <li key={r.v.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">
                      <Link href={`/negocios/${r.v.leadId}`} className="hover:underline" title="Abrir la ficha del negocio">
                        {r.name}
                      </Link>
                    </p>
                    {r.v.note && <p className="text-sm text-(--av-muted)">{r.v.note}</p>}
                  </div>
                  <p className={`text-sm ${d && d <= today ? "font-medium text-red-700" : "text-(--av-muted)"}`}>{when}</p>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-(--av-muted)">Los que tocan hoy o ya se pasaron aparecen solos en la próxima ruta del día.</p>
        </Panel>
      )}

      <Panel title={`Historial (${rows.length})`} collapsible>
        <ul className="divide-y-2 divide-(--av-sunk)">
          {rows.map((r) => (
            <li key={r.v.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                      <Link href={`/negocios/${r.v.leadId}`} className="hover:underline" title="Abrir la ficha del negocio">
                        {r.name}
                      </Link>
                    </p>
                <Chip tone={RESULT_TONE[r.v.result] ?? "idle"}>{RESULT[r.v.result]}</Chip>
              </div>
              <p className="text-sm text-(--av-muted)">
                {r.v.visitedAt.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" })}
                {r.address ? ` · ${r.address}` : ""}
                {r.v.doNotContact ? " · pasado a no contactar" : ""}
                {r.v.comeBackOn ? ` · volver el ${fmtDay(r.v.comeBackOn)}` : ""}
              </p>
              {r.v.note && <p className="mt-1 text-sm whitespace-pre-wrap">{r.v.note}</p>}
              {r.slug && (
                <a href={`/demo/${r.slug}`} target="_blank" className="mt-1 inline-block text-sm font-medium underline">
                  Ver la demo que mostraste
                </a>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
