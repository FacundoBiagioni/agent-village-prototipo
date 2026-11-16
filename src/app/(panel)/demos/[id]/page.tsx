import { and, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { db, schema } from "@/db";
import type { Photo } from "@/demos/brand";
import type { DemoContent } from "@/demos/content";
import { DIRECTIONS, directionOf, FONT_PACKS, fontPackFor, PALETTES } from "@/demos/directions";
import { MAX_PHOTOS, servicesToText } from "@/demos/edit";
import { PageHeader, Panel } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { AESTHETICS, type AestheticId } from "@/demos/gallery";
import { templateNicheOf } from "@/demos/gallery-store";
import { requestOpusRedesign, saveDemoEdit } from "../actions";

const input = "rounded-md border border-stone-300 p-2 text-sm";
const PHOTO_SOURCE: Record<Photo["source"], string> = { web: "De su web", manual: "Subida", instagram: "De su Instagram" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditDemoPage({ params, searchParams }: PageProps<"/demos/[id]">) {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <Suspense fallback={<p className="text-(--av-muted)">Cargando…</p>}>
        <Editor params={params} searchParams={searchParams as Promise<{ error?: string; ok?: string; skipped?: string; ig?: string }>} />
      </Suspense>
    </main>
  );
}

async function Editor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string; skipped?: string; ig?: string }> }) {
  await connection();
  const { id } = await params;
  const q = await searchParams;
  if (!UUID.test(id)) notFound();
  const [row] = await db
    .select({ demo: schema.demos, name: schema.leads.name, niche: schema.leads.niche, category: schema.leads.category })
    .from(schema.demos)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.demos.leadId))
    .where(eq(schema.demos.id, id));
  if (!row) notFound();
  const c = row.demo.content as DemoContent;
  // Plantillas aprobadas de la galería para este rubro (y la que ya usa, aunque después se haya retirado).
  const tNiche = templateNicheOf(row);
  const gallery = tNiche
    ? await db
        .select({ id: schema.templates.id, aesthetic: schema.templates.aesthetic, format: schema.templates.format })
        .from(schema.templates)
        .where(and(eq(schema.templates.niche, tNiche), c.templateId ? sql`(${schema.templates.status} = 'approved' or ${schema.templates.id} = ${c.templateId})` : eq(schema.templates.status, "approved")))
    : [];
  // Último pedido a Opus para esta demo: si falló, el motivo se muestra acá (antes solo se veía en el Pueblo).
  const [opusRun] = await db
    .select({ status: schema.agentRuns.status, error: schema.agentRuns.error, at: schema.agentRuns.createdAt })
    .from(schema.agentRuns)
    .where(and(eq(schema.agentRuns.taskType, "redisenar_opus"), sql`${schema.agentRuns.input}->>'demoId' = ${id}`))
    .orderBy(desc(schema.agentRuns.createdAt))
    .limit(1);
  const brand = c.brand ?? { photos: [] };
  const field = (name: string, label: string, value: string, rows = 1, hint?: string) => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {rows === 1 ? <input name={name} defaultValue={value} className={input} required /> : <textarea name={name} defaultValue={value} rows={rows} className={input} required />}
      {hint && <span className="text-xs text-(--av-muted)">{hint}</span>}
    </label>
  );
  return (
    <>
      <PageHeader title={row.name}>
        <div className="flex items-center gap-4">
          <Link href={`/demo/${row.demo.slug}`} target="_blank" className="av-btn av-btn-coin text-sm">
            Ver demo
          </Link>
        </div>
      </PageHeader>
      {q.error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">No se guardó: {q.error}</p>}
      {q.ok && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
          Guardado (versión {row.demo.version}).{q.skipped && ` ${q.skipped} foto(s) no se usaron: más de ${MAX_PHOTOS}, de más de 10 MB, de menos de 600 px de ancho o que no eran imágenes.`}
        </p>
      )}
      {q.ig && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="alert">No se pudieron traer fotos de Instagram: {q.ig}</p>}
      {opusRun && (opusRun.status === "queued" || opusRun.status === "working") && (
        <p data-working className="rounded-md bg-sky-50 p-3 text-sm text-sky-900" role="status">
          El Diseñador está armando la versión de Opus (cerca de 1 o 2 minutos). Esta página se actualiza sola al terminar.
        </p>
      )}
      {opusRun?.status === "failed" && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          El rediseño con Opus del {opusRun.at.toLocaleString("es-AR")} no se guardó: {opusRun.error?.replace(/^Error:\s*/, "")}. La demo sigue como estaba; podés volver a pedirlo.
        </p>
      )}
      {opusRun?.status === "done" && c.design === "opus" && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
          La demo muestra la versión de Opus (hecha el {opusRun.at.toLocaleString("es-AR")}). Para volver a la plantilla, cambiá &quot;Versión que se muestra&quot; abajo.
        </p>
      )}
      <ResearchPanel research={c.research} />
      <Panel title="Rediseño a medida con Opus" collapsible defaultOpen={false}>
        <form action={requestOpusRedesign} className="flex flex-wrap items-center gap-3 text-sm">
          <input type="hidden" name="id" value={row.demo.id} />
          <SubmitButton pendingText="Pidiendo…" className="av-btn">
            {c.opus ? "Rediseñar de nuevo con Opus" : "Rediseñar con Opus"}
          </SubmitButton>
          <span className="text-xs text-(--av-muted)">Página completa hecha por Opus con estos textos y fotos. Gasta bastante cuota. Si no pasa los controles (links, aviso, textos), no se guarda.</span>
        </form>
      </Panel>
      {/* Un solo formulario (se guarda todo junto), en tres bloques. */}
      <form action={saveDemoEdit} className="space-y-6">
        <input type="hidden" name="id" value={row.demo.id} />
        <Section title="Diseño">
        <label className="flex flex-col gap-1 text-sm">
          Dirección de diseño
          <select name="direction" defaultValue={directionOf(row.demo.template)} className={input}>
            {Object.entries(DIRECTIONS).map(([id, d]) => (
              <option key={id} value={id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Paleta
          <select name="palette" defaultValue={brand.palette ?? ""} className={input}>
            <option value="">La de la dirección</option>
            {Object.entries(PALETTES).map(([id, p]) => (
              <option key={id} value={id}>
                {p.label} (solo en {DIRECTIONS[p.direction].label})
              </option>
            ))}
          </select>
        </label>
        {(c.opus || gallery.length > 0) && (
          <label className="flex flex-col gap-1 text-sm">
            Versión que se muestra y se publica
            <select name="design" defaultValue={c.design === "galeria" && c.templateId ? `galeria:${c.templateId}` : (c.design ?? "template")} className={input}>
              <option value="template">Plantilla de siempre (dirección de diseño de abajo)</option>
              {gallery.map((t) => (
                <option key={t.id} value={`galeria:${t.id}`}>
                  Galería: {AESTHETICS[t.aesthetic as AestheticId]?.name ?? t.aesthetic} ({t.format === "multipage" ? "varias páginas" : "landing"})
                </option>
              ))}
              {c.opus && <option value="opus">Opus, del {new Date(c.opus.createdAt).toLocaleDateString("es-AR")} (usa los textos de ese momento)</option>}
            </select>
            <span className="text-xs text-(--av-muted)">Las de la galería y la de siempre se actualizan con los textos y fotos de esta página.</span>
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Tipografías
          <select name="fonts" defaultValue={fontPackFor(directionOf(row.demo.template), brand.fonts).id} className={input}>
            {Object.entries(FONT_PACKS).map(([dir, packs]) => (
              <optgroup key={dir} label={DIRECTIONS[dir as keyof typeof DIRECTIONS].label}>
                {packs.map((p, i) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {i === 0 ? " (la de la ficha)" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className="text-xs text-(--av-muted)">Si elegís una de otra dirección, va la de la ficha de la dirección elegida.</span>
        </label>
        </Section>
        <Section title="Marca y fotos">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="useBrandColor" defaultChecked={!!brand.color} />
              Usar el color de la marca
            </label>
            <input type="color" name="brandColor" defaultValue={brand.color ?? DIRECTIONS[directionOf(row.demo.template)].tokens.accent} aria-label="Color de la marca" className="h-9 w-14 rounded border-2 border-(--av-line)" />
            <span className="text-xs text-(--av-muted)">Si no se marca, va el color de la dirección. Si el color no da contraste, el sistema lo oscurece.</span>
          </div>
          {brand.photos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {brand.photos.map((p) => (
                <li key={p.src} className="space-y-1 text-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local */}
                  <img src={p.src} alt="" width={p.w} height={p.h} className="aspect-square w-full rounded object-cover" />
                  <label className="flex items-center gap-1">
                    <input type="checkbox" name="removePhoto" value={p.src} /> Quitar
                  </label>
                  <span className="block text-(--av-muted)">{PHOTO_SOURCE[p.source]} · {p.w} px</span>
                </li>
              ))}
            </ul>
          )}
          <label className="flex flex-col gap-1 text-sm">
            Sumar fotos (hasta {MAX_PHOTOS} en total)
            <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple className="text-sm" />
            <span className="text-xs text-(--av-muted)">Una foto de 1200 px de ancho o más va arriba, a pantalla completa. Las más chicas van en tarjetas. Menos de 600 px no se usan. Sin pacientes ni clientes reconocibles.</span>
          </label>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              Instagram del negocio
              <input name="instagram" defaultValue={brand.instagram ? `@${brand.instagram}` : ""} placeholder="@usuario o link" className={input} />
            </label>
            <label className="flex items-center gap-2 pb-2">
              <input type="checkbox" name="importInstagram" /> Traer fotos de su Instagram
            </label>
            <span className="w-full text-xs text-(--av-muted)">Solo cuentas de empresa o creador. Completa hasta {MAX_PHOTOS} fotos, sin videos.</span>
          </div>
        </Section>
        <Section title="Textos">
        {field("headline", "Título", c.headline)}
        {field("subheadline", "Subtítulo", c.subheadline, 2)}
        {field("about", "Sobre el negocio", c.about, 4)}
        {field("services", "Servicios (uno por línea: Título | descripción)", servicesToText(c.services), 6, "Entre 3 y 6.")}
        {field("highlights", "Destacados (uno por línea)", c.highlights.join("\n"), 4, "Entre 2 y 4.")}
        {field("ctaLabel", "Texto del botón", c.ctaLabel)}
        <p className="text-xs text-(--av-muted)">El teléfono y la dirección los pone el sistema. Rige lo mismo que para la IA: sin links, teléfonos, tuteo ni promesas.</p>
        </Section>
        {/* Guardar siempre a mano: fijo abajo mientras se edita (arriba de la barra del celular). */}
        <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
          <SubmitButton pendingText="Guardando…" className="av-btn av-btn-coin px-6 shadow-[3px_3px_0_var(--av-line)]">
            Guardar cambios
          </SubmitButton>
        </div>
      </form>
    </>
  );
}

/** Bloque del formulario de edición (mismo aspecto que un panel; los campos siguen en el mismo <form>). */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="av-panel overflow-hidden">
      <h2 className="border-b-2 border-(--av-line) px-4 py-2 text-lg leading-tight">{title}</h2>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

const KIND: Record<string, string> = { web: "Web", instagram: "Instagram", facebook: "Facebook", google_maps: "Google Maps", tiktok: "TikTok", linkedin: "LinkedIn", whatsapp: "WhatsApp", directorio: "Directorio", otro: "Otro" };

/** Lo que encontró el Analista en internet (solo para vos: no va en la demo). Facebook y Maps quedan como links para mirar a mano. */
function ResearchPanel({ research }: { research?: DemoContent["research"] }) {
  return (
    <Panel title="Lo que encontró el Analista" collapsible aside={research && <span className="text-xs text-(--av-muted)">{new Date(research.searchedAt).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}>
      {!research ? (
        <p className="text-sm text-(--av-muted)">Esta demo es de antes de la investigación en internet (o la búsqueda falló). Las nuevas traen acá las redes del negocio.</p>
      ) : (
        <>
          {research.links.length === 0 ? (
            <p className="text-sm text-(--av-muted)">No encontró redes ni web de este negocio.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {research.links.map((l) => (
                <li key={l.url} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="av-title w-28 shrink-0">{KIND[l.kind] ?? l.kind}</span>
                  <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 break-all font-medium underline">
                    {l.url.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                  {l.why && <span className="w-full pl-30 text-xs text-(--av-muted)">{l.why}</span>}
                </li>
              ))}
            </ul>
          )}
          {research.notes && <p className="mt-3 text-sm">{research.notes}</p>}
          <p className="mt-3 text-xs text-(--av-muted)">Las fotos se toman solo de su web e Instagram. De Facebook o Google Maps, si te gusta alguna, bajala y subila abajo, en Fotos.</p>
        </>
      )}
    </Panel>
  );
}
