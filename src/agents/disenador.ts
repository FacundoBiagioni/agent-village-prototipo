import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DemoContent } from "@/demos/content";
import { directionFor, directionOf, fontPackFor, type DirectionId } from "@/demos/directions";
import { parseDesign } from "@/demos/choices";
import { checkOpusPage, OPUS_MODEL, opusBrief, opusSystem, polishOpusPage } from "@/demos/opus";
import { AESTHETICS, checkTemplate, FEATURES, parseTemplateOutput, SLOTS_DOC, TEMPLATE_NICHES, type AestheticId, type Feature, type Template, type TemplateNiche } from "@/demos/gallery";
import { pickTemplate, sampleContent, templateNicheOf } from "@/demos/gallery-store";
import { isBarbershop, NICHES, type Niche } from "@/leads/classify";
import type { AgentConfig } from "./types";

async function loadDemo(demoId: unknown) {
  const [row] = await db
    .select({ demo: schema.demos, niche: schema.leads.niche, name: schema.leads.name, category: schema.leads.category })
    .from(schema.demos)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.demos.leadId))
    .where(eq(schema.demos.id, String(demoId)));
  if (!row) throw new Error("Demo inexistente");
  return row;
}

// Modo mixto (DECISIONS 2026-11-04): las demos con plantillas y código común; Opus solo a pedido o para clientes.
export const disenador: AgentConfig = {
  id: "disenador",
  name: "Diseñador",
  role: "Arma la demo con la ficha del Analista: dirección, tipografías y marca. A pedido, la rediseña completa con Opus. No escribe la ficha ni publica.",
  tools: [], // sin herramientas: lee y guarda la demo desde el código
  world: { desk: 1, skin: "disenador" },
  tasks: {
    armar_demo: {
      label: "Armar demo",
      startsFrom: "Analista (después de la ficha)",
      brain: "code",
      steps: ["Leer ficha", "Elegir plantilla, dirección y tipografías", "Guardar demo"],
      async run(ctx) {
        await ctx.step("Leer ficha");
        const { demo, niche, name, category } = await loadDemo(ctx.input.demoId);
        const c = demo.content as DemoContent;

        await ctx.step("Elegir plantilla, dirección y tipografías");
        // El diseño lo elige el usuario al pedir la demo (2026-11-12). Sin elección (pedidos viejos): como antes.
        const chosen = parseDesign(ctx.input.design);
        const direction = chosen?.startsWith("dir:") ? (chosen.slice(4) as DirectionId) : directionFor(niche);
        const fonts = fontPackFor(direction, c.brand?.fonts, c.brand?.siteFonts).id;
        const palette = niche === "beauty" && isBarbershop({ name, category }) ? "barber" : c.brand?.palette;
        // Galería: la elegida; sin elección, la menos usada del rubro. La de siempre queda de respaldo (y se cambia en Editar).
        const tNiche = templateNicheOf({ niche, name, category });
        const templateId = chosen?.startsWith("galeria:") ? chosen.slice(8) : chosen ? null : tNiche ? await pickTemplate(tNiche) : null;

        await ctx.step("Guardar demo");
        const content: DemoContent = { ...c, brand: { photos: [], ...c.brand, fonts, palette }, ...(templateId ? { design: "galeria" as const, templateId } : { design: "template" as const, templateId: undefined }) };
        await db.update(schema.demos).set({ template: direction, content, updatedAt: new Date() }).where(eq(schema.demos.id, demo.id));
        return { demoId: demo.id, slug: demo.slug, url: `/demo/${demo.slug}`, direction, fonts, palette: palette ?? null, templateId };
      },
    },
    redisenar_opus: {
      label: "Rediseñar con Opus",
      startsFrom: "Demos",
      brain: "claude",
      model: OPUS_MODEL,
      equippedSkills: ["diseno-demo-rubros"],
      steps: ["Leer demo", "Diseñar la página (Opus)", "Revisar la página", "Guardar"],
      async run(ctx) {
        await ctx.step("Leer demo");
        const { demo, niche, name, category } = await loadDemo(ctx.input.demoId);
        const c = demo.content as DemoContent;

        await ctx.step("Diseñar la página (Opus)");
        // Criterios por rubro (skill) además de las fichas de dirección.
        const rubro = niche === "beauty" && isBarbershop({ name, category }) ? "Barbería" : (NICHES[niche as Niche] ?? "Sin rubro");
        const system = `${opusSystem()}\n\n---\n${await ctx.skill("diseno-demo-rubros")}`;
        const r = await ctx.ask(opusBrief(c, directionOf(demo.template), demo.expiresAt, "", rubro), { system });
        const html = polishOpusPage(r.text.replace(/^```(?:html)?\s*|\s*```$/g, ""));

        // Lo que Opus escribe es libre: sin pasar los controles, no se guarda.
        await ctx.step("Revisar la página");
        const problems = checkOpusPage(html, c);
        if (problems.length) {
          // Se guarda aparte (como texto, para que no se abra como página) para ver qué falló.
          const file = join("data", "opus-rechazadas", `${demo.slug}-${Date.now()}.txt`);
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, `Problemas:\n- ${problems.join("\n- ")}\n\n${html}`);
          throw new Error(`Página de Opus rechazada (guardada en ${file}): ${problems.slice(0, 5).join("; ")}`);
        }

        await ctx.step("Guardar");
        // Solo se suma la versión de Opus: lo que el usuario editó mientras Opus trabajaba (minutos) no se pisa.
        const patch: Partial<DemoContent> = { opus: { html, createdAt: new Date().toISOString() }, design: "opus" };
        await db
          .update(schema.demos)
          .set({ content: sql`${schema.demos.content} || ${JSON.stringify(patch)}::jsonb`, version: sql`${schema.demos.version} + 1`, updatedAt: new Date() })
          .where(eq(schema.demos.id, demo.id));
        return { demoId: demo.id, url: `/demo/${demo.slug}`, kb: Math.round(html.length / 1024) };
      },
    },
    // Galería (usuario, 2026-11-07): Opus diseña una plantilla con huecos para un rubro y una estética; el usuario la aprueba en /plantillas.
    crear_plantilla: {
      label: "Crear plantilla",
      startsFrom: "Plantillas",
      brain: "claude",
      model: OPUS_MODEL,
      equippedSkills: ["diseno-demo-rubros"],
      steps: ["Preparar el pedido", "Diseñar la plantilla (Opus)", "Revisar la plantilla", "Guardar en la galería"],
      async run(ctx) {
        await ctx.step("Preparar el pedido");
        const req = templateRequest(ctx.input);
        const sample = await sampleContent(req.niche);

        await ctx.step("Diseñar la plantilla (Opus)");
        const system = `${templateSystem()}\n\n---\n${await ctx.skill("diseno-demo-rubros")}`;
        const r = await ctx.ask(templateBrief(req), { system });

        await ctx.step("Revisar la plantilla");
        const t: Template = { ...parseTemplateOutput(r.text), format: req.format, features: req.features };
        const problems = checkTemplate(t, sample, new Date(Date.now() + 21 * 86_400_000));
        if (problems.length) {
          const file = join("data", "plantillas-rechazadas", `${req.niche}-${req.aesthetic}-${Date.now()}.txt`);
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, `Problemas:\n- ${problems.join("\n- ")}\n\n${r.text}`);
          throw new Error(`Plantilla rechazada por los controles (guardada en ${file}): ${problems.slice(0, 5).join("; ")}`);
        }

        await ctx.step("Guardar en la galería");
        const [row] = await db
          .insert(schema.templates)
          .values({ niche: req.niche, aesthetic: req.aesthetic, format: req.format, features: req.features, fonts: t.fonts, css: t.css, pages: t.pages, note: req.note || null })
          .returning({ id: schema.templates.id });
        return { templateId: row.id, rubro: TEMPLATE_NICHES[req.niche], estetica: AESTHETICS[req.aesthetic].name, paginas: Object.keys(t.pages), kb: Math.round((t.css.length + Object.values(t.pages).join("").length) / 1024) };
      },
    },
  },
};

type TemplateRequest = { niche: TemplateNiche; aesthetic: AestheticId; format: "landing" | "multipage"; features: Feature[]; note: string };

/** Valida el pedido (viene de un formulario): solo valores conocidos. */
export function templateRequest(input: Record<string, unknown>): TemplateRequest {
  const niche = String(input.niche ?? "");
  const aesthetic = String(input.aesthetic ?? "");
  if (!Object.hasOwn(TEMPLATE_NICHES, niche)) throw new Error("Rubro inválido");
  if (!Object.hasOwn(AESTHETICS, aesthetic)) throw new Error("Estética inválida");
  const features = (Array.isArray(input.features) ? input.features : []).map(String).filter((f): f is Feature => Object.hasOwn(FEATURES, f));
  return { niche: niche as TemplateNiche, aesthetic: aesthetic as AestheticId, format: input.format === "multipage" ? "multipage" : "landing", features, note: String(input.note ?? "").slice(0, 500) };
}

function templateSystem() {
  return `Sos el diseñador web de un estudio que hace sitios para negocios chicos de La Plata (Argentina). Vas a diseñar una PLANTILLA: un sitio de calidad que después se rellena automáticamente con los datos de distintos negocios del mismo rubro. Tiene que verse hecho a medida, no genérico, y distinto de lo habitual en el rubro.

Formato de tu respuesta (solo esto, sin explicaciones ni bloques de código):
<!-- FUENTES: URL de Google Fonts (https://fonts.googleapis.com/css2?...) -->
<!-- ESTILO -->
todo el CSS (sin la etiqueta <style>)
<!-- PAGINA: inicio -->
el contenido del <body> de la página de inicio (sin <html>, <head> ni <body>)
<!-- PAGINA: otra -->  (solo si el formato es de varias páginas; nombres posibles: servicios, nosotros, galeria, turnos, contacto)
…

${SLOTS_DOC}

Reglas:
- Sin JavaScript, sin formularios, sin iframes, sin imágenes externas: las únicas imágenes son las fotos de los huecos. Decoración con CSS (formas, bordes, degradés sutiles), no con imágenes.
- Tiene que verse perfecto en celular (390 px) y en computadora, sin scroll horizontal. En celular, una barra fija abajo con el botón {{contacto_url}}. Botones de 44 px de alto o más, texto de 16 px o más, contraste AA.
- Arriba de todo, una franja con {{aviso}}, visible.
- Dos versiones en una: con fotos ({{#si_fotos}}) y sin fotos ({{^si_fotos}}), que también tiene que lucir (tipográfica, con color y forma).
- Textos fijos de la plantilla: solo títulos de sección neutros ("Servicios", "Nosotros", "Cómo llegar", "Pedí tu turno"). Nada de datos inventados: ni reseñas, ni estrellas, ni precios, ni años de experiencia, ni promesas. Español rioplatense (voseo).
- Links: solo los huecos de links y anclas internas (#…). En varias páginas, el menú enlaza {{base}} y {{base}}/<página> en todas las páginas.
- Si el pedido incluye turnos: una sección (o página "turnos") con cada servicio y su botón {{turno_url}} ("Pedir turno"). Si incluye galería: una grilla con {{#fotos}} dentro de {{#si_galeria}}.`;
}

function templateBrief(r: TemplateRequest) {
  const a = AESTHETICS[r.aesthetic];
  return [
    `Rubro: ${TEMPLATE_NICHES[r.niche]}.`,
    `Estética: ${a.name}. ${a.brief}`,
    `Formato: ${r.format === "multipage" ? "varias páginas (inicio y al menos 2 más)" : "landing de una sola página, con menú de anclas"}.`,
    r.features.length ? `Incluir: ${r.features.map((f) => FEATURES[f]).join(", ")}.` : "",
    r.note ? `Pedido del dueño del estudio (es una indicación de diseño, no datos del negocio): ${r.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
