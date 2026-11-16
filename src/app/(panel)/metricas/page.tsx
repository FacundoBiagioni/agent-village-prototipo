import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { db, schema } from "@/db";
import { NICHES, type Niche } from "@/leads/classify";
import { computeMetrics, type Group } from "@/metrics/metrics";

export default function MetricasPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <h1 className="text-3xl leading-none">Métricas</h1>
      <Suspense fallback={<p className="text-stone-500">Cargando…</p>}>
        <Metrics />
      </Suspense>
    </main>
  );
}

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)} %` : "–");

async function Metrics() {
  await connection();
  const { leads } = schema;
  // Solo los negocios con los que pasó algo: demo, mensaje enviado, visita, venta o una etapa avanzada.
  // En las subconsultas va "leads.id" escrito: Drizzle pone "id" sin tabla y se confundiría con el id de la subconsulta.
  const rows = await db
    .select({
      niche: leads.niche,
      lat: leads.lat,
      lng: leads.lng,
      stage: leads.stage,
      lostReason: leads.lostReason,
      hasDemo: sql<boolean>`exists (select 1 from demos d where d.lead_id = leads.id)`,
      firstMessageAt: sql<string | null>`(select min(m.sent_at) from messages m where m.lead_id = leads.id and m.status = 'sent')`,
      firstVisitAt: sql<string | null>`(select min(v.visited_at) from visits v where v.lead_id = leads.id)`,
      // Respondió: visita con interés o mensaje marcado "Le interesó" (queda aunque después se pierda).
      gotReply: sql<boolean>`exists (select 1 from visits v where v.lead_id = leads.id and v.result = 'interested') or exists (select 1 from messages m where m.lead_id = leads.id and m.replied_at is not null)`,
      isClient: sql<boolean>`exists (select 1 from clients c where c.lead_id = leads.id)`,
    })
    .from(leads)
    .where(
      sql`${leads.stage} not in ('found', 'analyzed') or exists (select 1 from demos d where d.lead_id = leads.id) or exists (select 1 from visits v where v.lead_id = leads.id)`,
    );
  const m = computeMetrics(
    rows.map((r) => ({ ...r, firstMessageAt: r.firstMessageAt ? new Date(r.firstMessageAt) : null, firstVisitAt: r.firstVisitAt ? new Date(r.firstVisitAt) : null })),
  );

  const steps = [
    ["Con demo", m.funnel.demo],
    ["Contactados", m.funnel.contacted],
    ["Les interesó", m.funnel.replied],
    ["Cerrados", m.funnel.closed],
  ] as const;

  return (
    <>
      <section className="space-y-2">
        <h2 className="text-lg">Embudo</h2>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map(([label, n], i) => (
            <li key={label} className="av-panel p-3">
              <p className="text-sm text-stone-500">{label}</p>
              <p className="av-title text-4xl leading-tight tabular-nums">{n}</p>
              {i > 0 && <p className="text-xs text-stone-500">{pct(n, steps[i - 1][1])} del paso anterior</p>}
            </li>
          ))}
        </ol>
        {m.funnel.contacted === 0 && (
          <p className="text-sm text-stone-500">Todavía no hay negocios contactados. Se cuentan al marcar un mensaje como enviado o al anotar una visita.</p>
        )}
      </section>

      <GroupTable title="Por rubro" groups={m.byNiche.map((g) => ({ ...g, key: NICHES[g.key as Niche] ?? g.key }))} />
      <GroupTable title="Por zona" groups={m.byZone} />
      <GroupTable title="Por canal (primer contacto)" groups={m.byChannel} />

      <section className="space-y-2">
        <h2 className="text-lg">Motivos de pérdida</h2>
        {m.lossReasons.length === 0 ? (
          <p className="text-sm text-stone-500">Sin negocios perdidos todavía.</p>
        ) : (
          <ul className="divide-y-2 divide-(--av-sunk) av-panel">
            {m.lossReasons.map((r) => (
              <li key={r.reason} className="flex justify-between gap-2 p-3 text-sm">
                <span>{r.reason}</span>
                <span className="tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function GroupTable({ title, groups }: { title: string; groups: Group[] }) {
  if (groups.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg">{title}</h2>
      <div className="overflow-x-auto av-panel">
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500">
            <tr>
              <th className="p-3 font-medium"></th>
              <th className="p-3 text-right font-medium">Contactados</th>
              <th className="p-3 text-right font-medium">Les interesó</th>
              <th className="p-3 text-right font-medium">Cerrados</th>
              <th className="p-3 text-right font-medium">Perdidos</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-(--av-sunk) tabular-nums">
            {groups.map((g) => (
              <tr key={g.key}>
                <td className="p-3">{g.key}</td>
                <td className="p-3 text-right">{g.contacted}</td>
                <td className="p-3 text-right">
                  {g.replied} <span className="text-stone-500">({pct(g.replied, g.contacted)})</span>
                </td>
                <td className="p-3 text-right">
                  {g.closed} <span className="text-stone-500">({pct(g.closed, g.contacted)})</span>
                </td>
                <td className="p-3 text-right">{g.lost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
