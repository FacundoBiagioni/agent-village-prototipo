import { Suspense } from "react";
import { connection } from "next/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { AESTHETICS, FEATURES, TEMPLATE_NICHES, type AestheticId, type TemplateNiche } from "@/demos/gallery";
import { SubmitButton } from "@/components/submit-button";
import { Chip, PageHeader, Panel } from "@/components/ui";
import { decideTemplate, redoTemplate, requestTemplate } from "./actions";

type Row = typeof schema.templates.$inferSelect;
const label = (t: Row) => `${TEMPLATE_NICHES[t.niche as TemplateNiche] ?? t.niche} · ${AESTHETICS[t.aesthetic as AestheticId]?.name ?? t.aesthetic}`;
const formatOf = (t: Row) => `${t.format === "multipage" ? `${Object.keys(t.pages as object).length} páginas` : "Landing"}${(t.features as string[]).length ? ` + ${(t.features as string[]).map((f) => FEATURES[f as keyof typeof FEATURES]?.toLowerCase() ?? f).join(" y ")}` : ""}`;

export default function PlantillasPage() {
  return (
    <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
      <PageHeader title="Plantillas" />
      <p className="mb-5 max-w-3xl text-sm text-(--av-muted)">
        El Diseñador crea plantillas con Opus para un rubro y una estética. Las ves acá con un negocio de ejemplo y decidís. Las aprobadas se usan solas en las demos nuevas de ese rubro (la menos usada primero), y en Demos → Editar podés cambiarla.
      </p>
      <div className="space-y-6">
        <NewTemplate />
        <Suspense fallback={<Panel title="Para revisar">Cargando…</Panel>}>
          <Gallery />
        </Suspense>
      </div>
    </main>
  );
}

function NewTemplate() {
  return (
    <Panel title="Encargar una plantilla" collapsible>
      <form action={requestTemplate} className="flex flex-col gap-4 text-sm">
        <label className="flex flex-col gap-1">
          Rubro
          <select name="niche" className="p-2">
            {Object.entries(TEMPLATE_NICHES).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <legend className="mb-1">Estética</legend>
          {Object.entries(AESTHETICS).map(([id, a], i) => (
            <label key={id} className="av-sunk flex cursor-pointer gap-2 p-2 has-checked:border-(--av-line) has-checked:bg-(--av-card)">
              <input type="radio" name="aesthetic" value={id} defaultChecked={i === 0} className="mt-1" />
              <span>
                <span className="font-semibold">{a.name}</span>
                <span className="block text-xs text-(--av-muted)">{a.brief}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-1">Formato</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="format" value="landing" defaultChecked /> Landing de una página
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="format" value="multipage" /> Varias páginas
          </label>
        </fieldset>
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-1">Incluir</legend>
          {Object.entries(FEATURES).map(([id, name]) => (
            <label key={id} className="flex items-center gap-2">
              <input type="checkbox" name="features" value={id} /> {name}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1">
          Indicaciones (opcional)
          <textarea name="note" rows={3} maxLength={500} placeholder="Por ejemplo: menú arriba fijo, mucho blanco, botones redondeados" className="p-2" />
        </label>
        <SubmitButton pendingText="Encargando…" className="av-btn av-btn-coin">
          Encargar plantilla
        </SubmitButton>
        <p className="text-xs text-(--av-muted)">Usa Opus: cada plantilla gasta bastante cuota. El Encargado la limita a 3 por día (se cambia en la Oficina).</p>
      </form>
    </Panel>
  );
}

async function Gallery() {
  await connection();
  const [rows, runs] = await Promise.all([
    db.select().from(schema.templates).where(inArray(schema.templates.status, ["pending", "approved"])).orderBy(desc(schema.templates.createdAt)),
    db
      .select({ id: schema.agentRuns.id, status: schema.agentRuns.status, input: schema.agentRuns.input, error: schema.agentRuns.error, stepLabel: schema.agentRuns.stepLabel, createdAt: schema.agentRuns.createdAt })
      .from(schema.agentRuns)
      .where(and(eq(schema.agentRuns.taskType, "crear_plantilla"), sql`(${schema.agentRuns.status} in ('queued', 'working') or (${schema.agentRuns.status} in ('failed', 'rejected') and ${gte(schema.agentRuns.createdAt, new Date(Date.now() - 86_400_000))}))`))
      .orderBy(desc(schema.agentRuns.createdAt)),
  ]);
  const usage = Object.fromEntries(
    (await db.select({ id: sql<string>`${schema.demos.content}->>'templateId'`, n: sql<number>`count(*)::int` }).from(schema.demos).where(sql`${schema.demos.content}->>'templateId' is not null`).groupBy(sql`1`)).map((u) => [u.id, u.n]),
  );
  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");
  const inProgress = runs.filter((r) => r.status === "queued" || r.status === "working");
  const failed = runs.filter((r) => r.status === "failed" || r.status === "rejected");
  const what = (input: unknown) => {
    const i = input as { niche?: string; aesthetic?: string };
    return `${TEMPLATE_NICHES[i.niche as TemplateNiche] ?? i.niche} · ${AESTHETICS[i.aesthetic as AestheticId]?.name ?? i.aesthetic}`;
  };

  return (
    <div className="space-y-6">
      {(inProgress.length > 0 || failed.length > 0) && (
        <Panel title="Encargadas" tone={inProgress.length ? "work" : "stuck"} collapsible>
          <ul className="space-y-2 text-sm">
            {inProgress.map((r) => (
              <li key={r.id} data-working className="flex flex-wrap items-center gap-2">
                <Chip tone="work">{r.status === "queued" ? "En cola" : "Diseñando"}</Chip> {what(r.input)} <span className="text-(--av-muted)">{r.stepLabel ?? ""}</span>
              </li>
            ))}
            {failed.map((r) => (
              <li key={r.id}>
                <Chip tone="stuck">{r.status === "rejected" ? "Frenada" : "No pasó"}</Chip> {what(r.input)}
                <span className="block text-xs text-(--av-muted)">{(r.error ?? "").replace(/^Error:\s*/, "").slice(0, 300)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={`Para revisar (${pending.length})`} tone={pending.length ? "wait" : undefined} collapsible>
        {pending.length === 0 && <p className="text-sm text-(--av-muted)">Nada para revisar. Encargá una plantilla y aparece acá cuando el Diseñador la termine.</p>}
        <ul className="space-y-6">
          {pending.map((t) => (
            <li key={t.id} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="av-title text-lg">{label(t)}</h3>
                <span className="text-xs text-(--av-muted)">{formatOf(t)}</span>
              </div>
              {t.note && <p className="text-xs text-(--av-muted)">Pedido: {t.note}</p>}
              <div className="grid gap-4 lg:grid-cols-[1fr_390px]">
                <iframe src={`/plantillas/${t.id}/vista`} title={`Vista previa: ${label(t)}`} sandbox="allow-popups" className="av-panel h-[80vh] min-h-140 w-full bg-white" />
                <iframe src={`/plantillas/${t.id}/vista`} title={`Vista previa en celular: ${label(t)}`} sandbox="allow-popups" className="av-panel mx-auto h-[80vh] min-h-140 w-[390px] max-w-full bg-white" />
              </div>
              {t.format === "multipage" && (
                <p className="text-xs text-(--av-muted)">
                  Páginas:{" "}
                  {Object.keys(t.pages as object).map((p) => (
                    <a key={p} href={`/plantillas/${t.id}/vista${p === "inicio" ? "" : `/${p}`}`} target="_blank" rel="noreferrer" className="mr-2 underline">
                      {p}
                    </a>
                  ))}
                </p>
              )}
              <div className="flex flex-wrap items-start gap-2">
                <form action={decideTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton name="decision" value="approved" pendingText="Guardando…" className="av-btn av-btn-coin">
                    Aprobar
                  </SubmitButton>
                </form>
                <form action={decideTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton name="decision" value="discarded" pendingText="Guardando…" className="av-btn">
                    Descartar
                  </SubmitButton>
                </form>
                <form action={redoTemplate} className="flex min-w-64 flex-1 gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input name="note" maxLength={300} placeholder="Qué cambiar (opcional)" aria-label="Qué cambiar al rehacerla" className="min-w-0 flex-1 p-2 text-sm" />
                  <SubmitButton pendingText="Encargando…" className="av-btn">
                    Rehacer
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={`Aprobadas (${approved.length})`} collapsible>
        {approved.length === 0 ? (
          <p className="text-sm text-(--av-muted)">Todavía no hay. Mientras tanto, las demos usan las plantillas de siempre.</p>
        ) : (
          <ul className="space-y-6">
            {approved.map((t) => (
              <li key={t.id} className="av-sunk flex flex-col gap-3 p-3 text-sm">
                <div className="grid gap-4 lg:grid-cols-[1fr_390px]">
                  <iframe src={`/plantillas/${t.id}/vista`} title={`Vista previa: ${label(t)}`} sandbox="allow-popups" loading="lazy" className="av-panel h-[75vh] min-h-120 w-full bg-white" />
                  <iframe src={`/plantillas/${t.id}/vista`} title={`Vista previa en celular: ${label(t)}`} sandbox="allow-popups" loading="lazy" className="av-panel mx-auto h-[75vh] min-h-120 w-[390px] max-w-full bg-white" />
                </div>
                <span className="font-semibold">{label(t)}</span>
                <span className="text-xs text-(--av-muted)">
                  {formatOf(t)} · usada en {usage[t.id] ?? 0} demo{usage[t.id] === 1 ? "" : "s"}
                </span>
                <div className="flex gap-2">
                  <a href={`/plantillas/${t.id}/vista`} target="_blank" rel="noreferrer" className="av-btn text-xs">
                    Abrir en otra pestaña
                  </a>
                  <form action={decideTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <SubmitButton name="decision" value="discarded" pendingText="Guardando…" className="av-btn text-xs" title="Deja de usarse en demos nuevas; las que ya la usan siguen igual">
                      Retirar
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
