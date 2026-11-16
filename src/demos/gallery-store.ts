// Galería de plantillas en la base: negocio de ejemplo para probarlas, elección para cada demo y páginas listas para mostrar o publicar.
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isBarbershop } from "@/leads/classify";
import type { DemoContent } from "./content";
import { renderTemplate, type Template, type TemplateNiche } from "./gallery";

type TemplateRow = typeof schema.templates.$inferSelect;
export const asTemplate = (r: TemplateRow): Template => ({ id: r.id, format: r.format, features: r.features as string[], fonts: r.fonts, css: r.css, pages: r.pages as Record<string, string> });

/** Rubro de plantilla de un negocio: la barbería es su propio rubro de plantillas, dentro de "beauty". */
export const templateNicheOf = (lead: { niche: string | null; name: string; category: string | null }): TemplateNiche | null =>
  lead.niche === "beauty" && isBarbershop(lead) ? "barber" : lead.niche === "dentist" || lead.niche === "beauty" || lead.niche === "architecture" ? lead.niche : null;

// Sin demos reales del rubro: un negocio inventado, sin fotos (la plantilla tiene que verse bien igual: versión tipográfica).
const FIXTURE: DemoContent = {
  headline: "Un lugar pensado para vos",
  subheadline: "Atención personalizada en La Plata",
  about: "Somos un equipo chico que atiende con tiempo y cuidado. Te escuchamos y te explicamos cada paso.",
  services: [
    { title: "Primera consulta", description: "Conocemos qué necesitás y armamos un plan." },
    { title: "Servicio principal", description: "El trabajo de todos los días, hecho con cuidado." },
    { title: "Seguimiento", description: "Controles para que el resultado dure." },
  ],
  highlights: ["Turnos por WhatsApp", "Atención personalizada", "En el centro de La Plata"],
  ctaLabel: "Pedir turno",
  business: { name: "Negocio de ejemplo", phone: "+5492215550000", whatsappUrl: "https://wa.me/5492215550000?text=Hola", callUrl: "tel:+5492215550000", address: "Calle 7 1234, La Plata", mapsUrl: "https://www.google.com/maps/search/?api=1&query=La%20Plata" },
  brand: { photos: [] },
};

/** Negocio de ejemplo del rubro para probar y mostrar una plantilla: la demo real con más fotos (solo se ve en el panel). */
export async function sampleContent(niche: TemplateNiche): Promise<DemoContent> {
  const rows = await db
    .select({ content: schema.demos.content, name: schema.leads.name, category: schema.leads.category, niche: schema.leads.niche })
    .from(schema.demos)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.demos.leadId))
    .where(sql`${schema.demos.status} <> 'removed'`)
    .orderBy(desc(sql`jsonb_array_length(coalesce(${schema.demos.content}->'brand'->'photos', '[]'::jsonb))`), desc(schema.demos.createdAt))
    .limit(200);
  const match = rows.find((r) => templateNicheOf(r) === niche);
  if (!match) return FIXTURE;
  const c = match.content as DemoContent;
  return { ...c, research: undefined, opus: undefined };
}

/** Plantilla aprobada para una demo nueva: la menos usada del rubro (así dos negocios no quedan iguales). null si no hay. */
export async function pickTemplate(niche: TemplateNiche): Promise<string | null> {
  const [row] = await db
    .select({ id: schema.templates.id })
    .from(schema.templates)
    .where(and(eq(schema.templates.niche, niche), eq(schema.templates.status, "approved")))
    .orderBy(sql`(select count(*) from demos d where d.content->>'templateId' = ${schema.templates.id}::text)`, sql`random()`)
    .limit(1);
  return row?.id ?? null;
}

export async function getTemplate(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(schema.templates).where(eq(schema.templates.id, id));
  return row ?? null;
}

/** Páginas de una demo hecha con una plantilla de la galería. `base`: /demo/<slug>/vista en local, /demo/<slug> al publicar. */
export async function galleryPages(c: DemoContent, expiresAt: Date, base: string) {
  const row = c.templateId ? await getTemplate(c.templateId) : null;
  if (!row) return null; // plantilla borrada: la demo cae a la plantilla de siempre
  return renderTemplate(asTemplate(row), c, expiresAt, base).pages;
}
