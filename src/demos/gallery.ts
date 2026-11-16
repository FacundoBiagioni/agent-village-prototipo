// Galería de plantillas del Diseñador (usuario, 2026-11-07). Opus diseña una vez una plantilla con huecos por rubro,
// estética y formato; después cada demo la rellena con su ficha usando código común (sin cuota). Solo las que el usuario
// aprueba en /plantillas se usan en demos. Lo que escribe Opus pasa los mismos controles que la versión de Opus (checkOpusPage).
import { displayPhone, type DemoContent } from "./content";
import { checkOpusPage, noticeText, polishOpusPage } from "./opus";

/** Las 5 estéticas (recomendadas por Claude y elegidas por el usuario el 2026-11-07). La descripción va tal cual a Opus. */
export const AESTHETICS = {
  editorial: { name: "Editorial cálida", brief: "Como una revista cuidada: serif con carácter para títulos, fondo papel cálido, mucho aire, jerarquía tipográfica fuerte, detalles finos. Sereno y confiable." },
  suiza: { name: "Minimal suiza", brief: "Estilo tipográfico internacional: grotesca, grilla estricta y visible, blanco y negro con UN solo color de acento, alineado a la izquierda, tamaños contrastados, nada decorativo." },
  fotografica: { name: "Fotográfica inmersiva", brief: "La foto manda: imágenes grandes a sangre, texto sobre imagen con velo para que se lea, secciones a pantalla completa, tipografía limpia y poco texto por pantalla." },
  boutique: { name: "Boutique premium", brief: "Lujo sobrio: fondo oscuro profundo, serif alta y fina, detalles en bronce o dorado usados con moderación, espaciado generoso, sensación de exclusividad." },
  organica: { name: "Orgánica natural", brief: "Cálida y amable: tonos tierra y verdes suaves, formas redondeadas u orgánicas, tipografía humanista, texturas sutiles, sensación de cuidado y bienestar." },
} as const;
export type AestheticId = keyof typeof AESTHETICS;

export const TEMPLATE_NICHES = { dentist: "Odontología", beauty: "Peluquería y estética", barber: "Barbería", architecture: "Estudio de arquitectura" } as const;
export type TemplateNiche = keyof typeof TEMPLATE_NICHES;
export const FEATURES = { turnos: "Sección de turnos", galeria: "Galería de trabajos" } as const;
export type Feature = keyof typeof FEATURES;
// Páginas posibles del formato de varias páginas (la URL es /demo/<slug>/<página>; inicio es la raíz).
export const PAGE_NAMES = ["inicio", "servicios", "nosotros", "galeria", "turnos", "contacto"] as const;

export type Template = { id?: string; format: string; features: string[]; fonts: string | null; css: string; pages: Record<string, string> };

/** Lo que Opus tiene que saber de los huecos: va en su instrucción. */
export const SLOTS_DOC = `Huecos (se reemplazan por los datos de cada negocio; escribilos tal cual, con doble llave):
- Textos: {{nombre}} {{titular}} {{bajada}} {{sobre}} {{cta}} (texto del botón principal) {{aviso}} (franja de propuesta, obligatoria arriba de todo) {{telefono}} {{direccion}}
- Links: {{contacto_url}} (botón principal: WhatsApp o teléfono) {{whatsapp_url}} {{llamar_url}} {{maps_url}} {{base}} (raíz de la demo: links entre páginas como {{base}}/servicios; inicio es {{base}})
- Listas (se repiten): {{#servicios}} … {{titulo}} {{descripcion}} {{turno_url}} … {{/servicios}} · {{#destacados}} … {{texto}} … {{/destacados}} · {{#fotos}} … <img src="{{src}}" width="{{ancho}}" height="{{alto}}" alt="Foto de {{nombre}}"> … {{/fotos}}
- Fotos sueltas: {{foto_1}} a {{foto_6}} (URL; vacía si no hay)
- Condiciones: {{#si_fotos}} … {{/si_fotos}} y lo contrario {{^si_fotos}} … {{/si_fotos}} (versión sin fotos: tipográfica). También si_galeria (3 fotos o más), si_whatsapp, si_telefono, si_direccion.
Nunca escribas datos reales ni de ejemplo: todo dato del negocio sale de un hueco.`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
type Data = Record<string, unknown>;

/** Relleno de huecos estilo mustache, mínimo: variables escapadas, listas, condiciones e invertidas. Devuelve los huecos desconocidos. */
export function fill(src: string, data: Data, unknown = new Set<string>()): { html: string; unknown: Set<string> } {
  const sections = src.replace(/\{\{([#^])([a-z0-9_]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g, (_, kind: string, key: string, inner: string) => {
    if (!(key in data)) unknown.add(key);
    const v = data[key];
    const truthy = Array.isArray(v) ? v.length > 0 : !!v;
    if (kind === "^") return truthy ? "" : fill(inner, data, unknown).html;
    if (!truthy) return "";
    if (Array.isArray(v)) return v.map((item) => fill(inner, { ...data, ...(item as Data) }, unknown).html).join("");
    return fill(inner, data, unknown).html;
  });
  const html = sections.replace(/\{\{([a-z0-9_]+)\}\}/g, (_, key: string) => {
    if (!(key in data)) {
      unknown.add(key);
      return "";
    }
    return esc(String(data[key] ?? ""));
  });
  return { html, unknown };
}

/** Los datos de un negocio para los huecos. */
export function slotData(c: DemoContent, expiresAt: Date, base: string): Data {
  const wa = c.business.whatsappUrl;
  const waNumber = wa?.match(/^https:\/\/wa\.me\/(\d+)/)?.[1];
  const contacto = wa ?? c.business.callUrl ?? c.business.mapsUrl;
  const photos = c.brand?.photos ?? [];
  const data: Data = {
    nombre: c.business.name,
    titular: c.headline,
    bajada: c.subheadline,
    sobre: c.about,
    cta: c.ctaLabel,
    aviso: noticeText(c.business.name, expiresAt),
    telefono: c.business.phone ? displayPhone(c.business.phone) : "",
    direccion: c.business.address ?? "",
    contacto_url: contacto,
    whatsapp_url: wa ?? "",
    llamar_url: c.business.callUrl ?? "",
    maps_url: c.business.mapsUrl,
    base,
    servicios: c.services.map((s) => ({
      titulo: s.title,
      descripcion: s.description,
      turno_url: waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hola, quiero pedir un turno para ${s.title}.`)}` : contacto,
    })),
    destacados: c.highlights.map((texto) => ({ texto })),
    fotos: photos.map((p) => ({ src: p.src, ancho: p.w, alto: p.h })),
    si_fotos: photos.length > 0,
    si_galeria: photos.length >= 3,
    si_whatsapp: !!wa,
    si_telefono: !!c.business.phone,
    si_direccion: !!c.business.address,
  };
  for (let i = 1; i <= 6; i++) data[`foto_${i}`] = photos[i - 1]?.src ?? "";
  return data;
}

/** Arma las páginas completas (HTML) de una plantilla con los datos de un negocio. */
export function renderTemplate(t: Template, c: DemoContent, expiresAt: Date, base: string) {
  const data = slotData(c, expiresAt, base);
  const unknown = new Set<string>();
  const head = `<meta charset="utf-8"><meta name="robots" content="noindex"><title>${esc(c.business.name)}</title>${t.fonts ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="${esc(t.fonts)}" rel="stylesheet">` : ""}<style>${t.css}</style>`;
  const pages: Record<string, string> = {};
  for (const [name, body] of Object.entries(t.pages)) {
    pages[name] = polishOpusPage(`<!doctype html><html lang="es-AR"><head>${head}</head><body>${fill(body, data, unknown).html}</body></html>`);
  }
  return { pages, unknown };
}

/** Lo que devuelve Opus: <!-- FUENTES: url -->, <!-- ESTILO --> css y cada <!-- PAGINA: nombre --> con su cuerpo. */
export function parseTemplateOutput(text: string): Omit<Template, "format" | "features"> {
  const t = text.replace(/^```(?:html)?\s*|\s*```$/g, "");
  const fonts = t.match(/<!--\s*FUENTES:\s*(\S+?)\s*-->/)?.[1] ?? null;
  const css = t.match(/<!--\s*ESTILO\s*-->([\s\S]*?)(?=<!--\s*PAGINA:)/)?.[1].replace(/<\/?style[^>]*>/g, "").trim() ?? "";
  const pages: Record<string, string> = {};
  for (const m of t.matchAll(/<!--\s*PAGINA:\s*([a-z]+)\s*-->([\s\S]*?)(?=<!--\s*PAGINA:|$)/g)) pages[m[1]] = m[2].trim();
  return { fonts, css, pages };
}

const REQUIRED = ["nombre", "aviso", "titular", "contacto_url"];

/** Controles de una plantilla nueva: formato, huecos y, rellenada con un negocio de ejemplo, los mismos de la versión de Opus. */
export function checkTemplate(t: Template, sample: DemoContent, expiresAt: Date): string[] {
  const p: string[] = [];
  const names = Object.keys(t.pages);
  if (!names.includes("inicio")) p.push("falta la página de inicio");
  if (names.some((n) => !(PAGE_NAMES as readonly string[]).includes(n))) p.push(`página desconocida: ${names.filter((n) => !(PAGE_NAMES as readonly string[]).includes(n)).join(", ")}`);
  if (t.format === "landing" && names.length !== 1) p.push("una landing tiene una sola página");
  if (t.format === "multipage" && names.length < 3) p.push("el formato de varias páginas necesita al menos 3");
  if (!t.css) p.push("falta el estilo (CSS)");
  if (t.fonts && !/^https:\/\/fonts\.googleapis\.com\/css2?\?/.test(t.fonts)) p.push("las tipografías tienen que venir de Google Fonts");
  if (/<\/?(html|head|body|style)\b/i.test(names.map((n) => t.pages[n]).join(""))) p.push("las páginas tienen que traer solo el contenido del <body>");
  const all = names.map((n) => t.pages[n]).join("\n");
  for (const r of REQUIRED) if (!all.includes(`{{${r}}}`)) p.push(`falta el hueco {{${r}}}`);
  if (!all.includes("{{#servicios}}")) p.push("falta la lista {{#servicios}}");
  if (t.features.includes("turnos") && !all.includes("{{turno_url}}")) p.push("pediste turnos y no usa {{turno_url}}");
  if (t.features.includes("galeria") && !all.includes("{{#fotos}}")) p.push("pediste galería y no usa {{#fotos}}");
  const { pages, unknown } = renderTemplate(t, sample, expiresAt, "/demo/ejemplo0000");
  if (unknown.size) p.push(`huecos desconocidos: ${[...unknown].join(", ")}`);
  for (const [name, html] of Object.entries(pages)) for (const x of checkOpusPage(html, sample, "/demo/ejemplo0000")) p.push(`${name}: ${x}`);
  return [...new Set(p)];
}
