import { Suspense } from "react";
import { and, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { SubmitButton } from "@/components/submit-button";
import { LeadsMap } from "@/components/leads-map";
import { UseMyLocation } from "@/components/use-my-location";
import { NICHES, type Niche } from "@/leads/classify";
import { DEFAULT_CENTER, googleMapsUrl, MAX_RADIUS_KM, searchLeads } from "@/leads/search";
import { designChoicesByNiche, templateNicheOf, type DesignChoice } from "@/demos/choices";
import type { TemplateNiche } from "@/demos/gallery";
import { addManualLead, markDoNotContact, prepareDemo, runSearch } from "./actions";

const WEB: Record<string, { label: string; tone: string }> = {
  none: { label: "Sin web", tone: "bg-emerald-100 text-emerald-800" },
  social_only: { label: "Solo redes o turnos", tone: "bg-emerald-100 text-emerald-800" },
  down: { label: "Web caída", tone: "bg-emerald-100 text-emerald-800" },
  outdated: { label: "Web anticuada", tone: "bg-amber-100 text-amber-800" },
  unchecked: { label: "Web sin revisar", tone: "bg-stone-100 text-stone-700" },
  ok: { label: "Web moderna", tone: "bg-stone-100 text-stone-500" },
};

type Params = { niche?: string; radius?: string; lat?: string; lng?: string; web?: string };
// Filtro "Tipo de web" (2026-11-10): los que nunca tuvieron web, y los que la tuvieron y se les quedó vieja o se les cayó.
const WEB_FILTER: Record<string, { label: string; statuses: string[] }> = {
  sin: { label: "Sin web (o solo redes)", statuses: ["none", "social_only"] },
  vieja: { label: "Web anticuada o caída", statuses: ["outdated", "down"] },
};
const input = "rounded-md border border-stone-300 p-2";

export default function BuscarPage({ searchParams }: PageProps<"/buscar">) {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <h1 className="text-3xl leading-none">Buscar negocios</h1>
      <Suspense fallback={<p className="text-stone-500">Cargando…</p>}>
        <SearchAndResults searchParams={searchParams as Promise<Params>} />
      </Suspense>
    </main>
  );
}

async function SearchAndResults({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const niche = p.niche && Object.hasOwn(NICHES, p.niche) ? (p.niche as Niche) : null;
  const radius = Number(p.radius) || 3;
  const lat = Number(p.lat) || DEFAULT_CENTER.lat;
  const lng = Number(p.lng) || DEFAULT_CENTER.lng;
  const web = p.web && Object.hasOwn(WEB_FILTER, p.web) ? p.web : "";
  const found = niche ? await searchLeads({ niche, lat, lng, radiusKm: radius }) : null;
  const data = found && web ? { ...found, results: found.results.filter((l) => WEB_FILTER[web].statuses.includes(l.webStatus)) } : found;
  const shown = data?.results.slice(0, 100) ?? [];
  const unchecked = found?.results.filter((l) => l.webStatus === "unchecked").length ?? 0;
  const state = await leadStates(shown.map((l) => l.id));
  const choices = await designChoicesByNiche(shown.map(templateNicheOf).filter((n): n is TemplateNiche => !!n));

  return (
    <>
      <form action={runSearch} className="grid gap-4 av-panel p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          Rubro
          <select name="niche" defaultValue={niche ?? "dentist"} className={input}>
            {Object.entries(NICHES).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Radio: hasta {MAX_RADIUS_KM} km
          <input type="number" name="radius" min={0.5} max={MAX_RADIUS_KM} step={0.5} defaultValue={radius} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tipo de web
          <select name="web" defaultValue={web} className={input}>
            <option value="">Todas</option>
            {Object.entries(WEB_FILTER).map(([id, f]) => (
              <option key={id} value={id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-md bg-stone-900 px-4 py-2 text-white hover:bg-stone-700">Buscar</button>
        <input type="hidden" name="lat" defaultValue={lat} />
        <input type="hidden" name="lng" defaultValue={lng} />
        <div className="sm:col-span-4">
          <UseMyLocation />
          <p className="mt-1 text-xs text-stone-500">Sin ubicación se busca desde Plaza Moreno, La Plata. Las búsquedas usan la copia local de Overture: no tienen costo ni límite.</p>
        </div>
      </form>

      {data && (
        <section aria-label="Resultados" className="space-y-3">
          <p className="text-sm text-stone-600">
            {data.results.length} negocios de {NICHES[niche!].toLowerCase()} a menos de {data.radiusKm} km{web ? ` (${WEB_FILTER[web].label.toLowerCase()})` : ""}, ordenados por oportunidad.
          </p>
          {unchecked > 0 && <p className="text-xs text-(--av-muted)">{unchecked} de esta zona tienen web todavía sin revisar: se revisan solas todos los días a las 10 y pueden resultar anticuadas.</p>}
          <LeadsMap
            center={[lat, lng]}
            radiusKm={data.radiusKm}
            leads={data.results.slice(0, 100).map((l) => ({
              id: l.id, name: l.name, lat: l.lat, lng: l.lng, score: l.score, webLabel: WEB[l.webStatus].label, mapsUrl: googleMapsUrl(l),
            }))}
          />
          <p className="text-xs text-stone-500">Verde: puntaje 80 o más · naranja: 60 a 79 · gris: menos de 60. El mapa muestra los mismos 100 primeros de la lista.</p>
          <ul className="space-y-2">
            {shown.map((l) => (
              <li key={l.id} className="flex flex-col gap-2 av-panel p-3 sm:flex-row sm:flex-wrap sm:items-center">
                <span className="av-title grid h-11 w-12 shrink-0 place-items-center rounded-lg border-2 border-(--av-line) text-lg" style={{ background: l.score >= 80 ? "var(--av-work)" : l.score >= 60 ? "var(--av-wait)" : "var(--av-sunk)", color: l.score >= 60 ? "var(--av-coin-ink)" : "var(--av-ink)" }} title="Puntaje de oportunidad (0 a 100): verde 80 o más, naranja 60 a 79">
                  {l.score}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <Link href={`/negocios/${l.id}`} className="hover:underline" title="Abrir la ficha del negocio">
                      {l.name}
                    </Link>
                  </p>
                  <p className="text-sm text-stone-500">
                    {l.distanceKm.toFixed(1)} km{l.address && ` · ${l.address}`}
                    {l.phone && ` · ${l.phone}`}
                  </p>
                </div>
                <span className={`w-fit rounded-full px-2 py-0.5 text-xs ${WEB[l.webStatus].tone}`}>{WEB[l.webStatus].label}</span>
                <a href={googleMapsUrl(l)} target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 text-sm text-sky-700 underline">
                  Ver en Google Maps
                </a>
                {l.niche && state.get(l.id) && <LeadState state={state.get(l.id)!} />}
                {l.niche && !state.get(l.id) && choices.get(templateNicheOf(l)!) && (
                  <details className="open:basis-full open:order-last">
                    <summary className="w-fit cursor-pointer rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700">Preparar demo</summary>
                    <form action={prepareDemo} className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={l.id} />
                      <DesignPicker choices={choices.get(templateNicheOf(l)!)!} />
                      <div className="flex flex-wrap gap-2">
                        <SubmitButton name="later" value="0" pendingText="Pidiendo…" className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700">
                          Preparar con este diseño
                        </SubmitButton>
                        <SubmitButton name="later" value="1" pendingText="Guardando…" className="av-btn text-sm " title="Queda guardada y la hacen cuando prendas el modo producción en la oficina">
                          Para el modo producción
                        </SubmitButton>
                      </div>
                    </form>
                  </details>
                )}
                <form action={markDoNotContact}>
                  <input type="hidden" name="id" value={l.id} />
                  <button className="py-1.5 text-sm text-stone-500 underline hover:text-red-700">No contactar</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="av-panel p-4">
        <summary className="cursor-pointer font-medium">Agregar un negocio a mano (visto en Google Maps)</summary>
        <form action={addManualLead} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Nombre
            <input name="name" required maxLength={200} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Rubro
            <select name="niche" defaultValue={niche ?? "dentist"} className={input}>
              {Object.entries(NICHES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Teléfono
            <input name="phone" inputMode="tel" placeholder="221 555 1234" className={input} />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" name="mobile" defaultChecked /> El teléfono es celular (tiene WhatsApp)
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Dirección
            <input name="address" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Link de Google Maps (para ubicarlo en el mapa)
            <input name="mapsUrl" type="url" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Web (si tiene)
            <input name="website" className={input} />
          </label>
          <input type="hidden" name="lat" value={lat} />
          <input type="hidden" name="lng" value={lng} />
          <button className="rounded-md bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 sm:col-span-2">Agregar</button>
        </form>
      </details>
    </>
  );
}

/** Los diseños del rubro, cada uno con una vista chiquita y el link para verlo entero. La elección es obligatoria. */
function DesignPicker({ choices }: { choices: DesignChoice[] }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Elegí el diseño según el perfil del negocio</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <label key={c.value} className="av-sunk block w-[200px] cursor-pointer p-1.5 text-xs has-checked:outline-2 has-checked:outline-(--av-coin)">
            {/* Vista chica: la página a 1280 px achicada, sin poder tocarla. Scripts sí (Next muestra el contenido con uno), pero en un origen aparte: no ve el panel. */}
            <span className="relative block h-[125px] w-full overflow-hidden rounded bg-white">
              <iframe src={c.previewUrl} title={`Vista de ${c.label}`} loading="lazy" sandbox="allow-scripts" tabIndex={-1} className="pointer-events-none absolute top-0 left-0 h-[800px] w-[1280px] origin-top-left scale-[0.1475] border-0" />
            </span>
            <span className="mt-1 flex items-start gap-1">
              <input type="radio" name="design" value={c.value} required className="mt-0.5" />
              <span className="min-w-0 flex-1">
                {c.label}
                {c.multipage && " (varias páginas)"}
              </span>
            </span>
            <a href={c.previewUrl} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">
              Ver entera
            </a>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type State = "scheduled" | "working" | "demo";

/** Qué pasa con cada negocio de la lista: guardado para el modo producción, en preparación o con demo hecha. */
async function leadStates(ids: string[]) {
  const out = new Map<string, State>();
  if (!ids.length) return out;
  const leadId = sql<string>`${schema.agentRuns.input}->>'leadId'`;
  const [runs, demos] = await Promise.all([
    db
      .select({ leadId, status: schema.agentRuns.status })
      .from(schema.agentRuns)
      .where(and(sql`${schema.agentRuns.taskType} = 'preparar_demo'`, inArray(schema.agentRuns.status, ["scheduled", "queued", "working"]), inArray(leadId, ids))),
    db.select({ leadId: schema.demos.leadId }).from(schema.demos).where(and(inArray(schema.demos.leadId, ids), sql`${schema.demos.status} <> 'removed'`)),
  ]);
  for (const r of runs) out.set(r.leadId, r.status === "scheduled" ? "scheduled" : "working");
  for (const d of demos) if (!out.has(d.leadId)) out.set(d.leadId, "demo");
  return out;
}

function LeadState({ state }: { state: State }) {
  if (state === "demo")
    return (
      <Link href="/demos" className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800 hover:underline">
        ✓ Demo creada
      </Link>
    );
  return (
    <span role="status" className="w-fit animate-[pulse_2s_ease-in-out_3] rounded-full bg-sky-100 px-3 py-1 text-sm text-sky-800">
      {state === "scheduled" ? "✓ Guardado para el modo producción" : "Preparando la demo…"}
    </span>
  );
}
