import { Suspense } from "react";
import { connection } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCatalog, installedFrom, OFFICIAL, type CatalogItem } from "@/runtime/skill-store";
import { SubmitButton } from "@/components/submit-button";
import { Chip, PageHeader, Panel } from "@/components/ui";
import { addSkillSource, refreshCatalog, removeSkillSource, requestSkillReview } from "./actions";

// Para qué agente le puede servir cada skill: palabras de su descripción (sugerencia del Encargado, no decide nada).
const FITS: { agent: string; re: RegExp }[] = [
  { agent: "Diseñador", re: /design|frontend|visual|typograph|theme|brand|canvas|aesthetic|ui\b/i },
  { agent: "Analista", re: /\b(writing|copywriting|copy|brand voice|research|summari[sz]e)\b/i },
  { agent: "Comunicador", re: /message|communicat|outreach|email|comms/i },
];

type Q = { ok?: string; error?: string };

export default function TiendaPage({ searchParams }: PageProps<"/tienda">) {
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <header>
        <PageHeader title="Tienda de skills" />
        <p className="-mt-2 text-sm text-(--av-muted)">
          Skills de GitHub: el catálogo oficial de Anthropic y los repositorios que agregues. Nada se instala solo: pedís una revisión, el Encargado revisa la licencia, los programas y el texto, y te deja el pedido en la bandeja (y en Telegram) para que lo apruebes. Se copia solo el texto de la skill, nunca programas.
        </p>
      </header>
      <form action={addSkillSource} className="flex flex-wrap gap-2">
        <label htmlFor="link" className="sr-only">Link de GitHub</label>
        <input id="link" name="link" required placeholder="Pegá un link de GitHub, por ejemplo https://github.com/dueño/repositorio" className="min-w-0 flex-1 px-3 py-1.5 text-sm" />
        <SubmitButton pendingText="Leyendo el repositorio…" className="av-btn av-btn-coin text-sm">
          Agregar a la tienda
        </SubmitButton>
      </form>
      <Suspense fallback={<p className="text-sm text-(--av-muted)">Cargando el catálogo…</p>}>
        <Catalog searchParams={searchParams as Promise<Q>} />
      </Suspense>
    </main>
  );
}

async function Catalog({ searchParams }: { searchParams: Promise<Q> }) {
  await connection();
  const q = await searchParams;
  const [catalog, pending] = await Promise.all([
    getCatalog(),
    // Lo que ya está en revisión o esperando tu aprobación.
    db
      .select({ name: sql<string>`${schema.agentRuns.input}->>'name'`, repo: sql<string | null>`${schema.agentRuns.input}->>'repo'` })
      .from(schema.agentRuns)
      .where(sql`${schema.agentRuns.taskType} = 'revisar_skill' and ${inArray(schema.agentRuns.status, ["queued", "working", "waiting_approval"])}`),
  ]);
  const inReview = new Set(pending.map((p) => `${p.repo ?? OFFICIAL}:${p.name}`));
  const installed = Object.fromEntries(await Promise.all([...new Set(catalog.items.map((i) => i.name))].map(async (n) => [n, await installedFrom(n)] as const)));
  return (
    <>
      {q.error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">No se agregó: {q.error}</p>}
      {q.ok && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{q.ok}</p>}
      <div className="flex items-center justify-between text-xs text-(--av-muted)">
        <span>Leído el {new Date(catalog.at).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        <form action={refreshCatalog}>
          <button className="py-1 underline hover:text-(--av-ink)">Volver a leer todo</button>
        </form>
      </div>
      {catalog.sources.map((s) => (
        <Panel
          key={s.repo}
          title={s.repo}
          collapsible
          aside={<span className="text-xs text-(--av-muted)">{s.repo === OFFICIAL ? "oficial de Anthropic" : "agregada por vos"} · {s.items.length} skill(s)</span>}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-(--av-muted)">
            <a href={`https://github.com/${s.repo}`} target="_blank" rel="noreferrer" className="inline-block py-1 underline hover:text-(--av-ink)">
              Ver en GitHub{s.commit && ` (versión ${s.commit.slice(0, 7)})`}
            </a>
            {s.repo !== OFFICIAL && (
              <form action={removeSkillSource}>
                <input type="hidden" name="repo" value={s.repo} />
                <button className="py-1 underline hover:text-red-700">Sacar de la tienda</button>
              </form>
            )}
          </div>
          {s.error && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">No se pudo leer: {s.error}</p>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {s.items.map((i) => (
              <Item key={i.path} item={i} installed={installed[i.name]} inReview={inReview.has(`${i.repo}:${i.name}`)} />
            ))}
          </ul>
        </Panel>
      ))}
    </>
  );
}

function Item({ item, installed, inReview }: { item: CatalogItem; installed: "own" | "store" | null; inReview: boolean }) {
  const scripts = item.files.filter((f) => /\.(py|js|mjs|cjs|ts|sh|ps1|bat|rb|php)$/i.test(f)).length;
  const fits = FITS.filter((f) => f.re.test(item.description)).map((f) => f.agent);
  return (
    <li className="av-sunk flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="av-title">{item.name}</h3>
        <Chip tone={item.allowed ? "work" : "idle"}>{item.allowed ? item.license : `${item.license}: no se puede`}</Chip>
      </div>
      <p className="line-clamp-3 text-sm">{item.description}</p>
      <p className="text-xs text-(--av-muted)">
        {item.files.length} archivos{scripts ? ` · ${scripts} programa(s) que no se instalan: si la skill depende de ellos, queda incompleta` : ""}
        {fits.length > 0 && ` · El Encargado la sugiere para: ${fits.join(", ")}`}
      </p>
      <div className="mt-auto">
        {installed === "store" && <p className="text-sm text-emerald-700">Instalada: equipala desde la oficina.</p>}
        {installed === "own" && <p className="text-sm text-(--av-muted)">Hay una skill propia con ese nombre.</p>}
        {!installed && inReview && <p className="text-sm text-amber-700">En revisión o esperando tu aprobación en la bandeja.</p>}
        {!installed && !inReview && item.allowed && (
          <form action={requestSkillReview}>
            <input type="hidden" name="name" value={item.name} />
            <input type="hidden" name="repo" value={item.repo} />
            <SubmitButton pendingText="Pidiendo…" className="av-btn text-sm">
              Pedir revisión e instalación
            </SubmitButton>
          </form>
        )}
      </div>
    </li>
  );
}
