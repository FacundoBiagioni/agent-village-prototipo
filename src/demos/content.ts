import type { Research } from "@/leads/research";
import { randomBytes } from "node:crypto";
import type { Brand } from "./brand";

// Lo que escribe el modelo: solo textos. Contacto y dirección los pone el código (no se pueden inventar); los colores, la dirección de diseño (directions.ts).
export type DemoCopy = {
  headline: string;
  subheadline: string;
  about: string;
  services: { title: string; description: string }[];
  highlights: string[];
  ctaLabel: string;
};

export type DemoContent = DemoCopy & {
  business: { name: string; phone: string | null; whatsappUrl: string | null; callUrl: string | null; address: string | null; mapsUrl: string };
  brand?: Brand; // las demos viejas no lo tienen
  /** Página completa de Opus, hecha a pedido (Diseñador). Usa los textos de cuando se armó. */
  opus?: { html: string; createdAt: string };
  /** Qué versión se muestra y se publica. Sin valor: la plantilla. "galeria": una plantilla aprobada de /plantillas (templateId). */
  design?: "template" | "opus" | "galeria";
  templateId?: string;
  /** Lo que encontró el Analista en internet: redes, web y notas (solo para el usuario, no va en la demo). */
  research?: Research;
};

const str = (maxLength: number) => ({ type: "string", minLength: 1, maxLength });
export const DEMO_COPY_SCHEMA = {
  type: "object",
  properties: {
    headline: str(80),
    subheadline: str(180),
    about: str(600),
    services: { type: "array", minItems: 3, maxItems: 6, items: { type: "object", properties: { title: str(50), description: str(200) }, required: ["title", "description"] } },
    highlights: { type: "array", minItems: 3, maxItems: 4, items: str(60) },
    ctaLabel: str(32),
  },
  required: ["headline", "subheadline", "about", "services", "highlights", "ctaLabel"],
};

// Contacto, links o datos que el modelo no debería escribir (los inventaría o vendrían de una orden inyectada).
const FORBIDDEN = /https?:\/\/|www\.|\S+@\S+\.\S+|\d[\d\s-]{6,}\d|\b(garantizad[oa]s?|sin dolor|100\s?%)/i;

/** Valida el texto del modelo. Devuelve la lista de problemas (vacía = válido). */
export function checkDemoCopy(c: unknown): string[] {
  const p: string[] = [];
  const d = c as Partial<DemoCopy> | null;
  if (!d || typeof d !== "object") return ["no es un objeto"];
  for (const k of ["headline", "subheadline", "about", "ctaLabel"] as const) if (typeof d[k] !== "string" || !d[k]!.trim()) p.push(`falta ${k}`);
  if (!Array.isArray(d.services) || d.services.length < 3 || d.services.length > 6) p.push("servicios: entre 3 y 6");
  // Al modelo se le piden 3 o 4; acá se aceptan 2 porque el código puede sacar el de WhatsApp.
  if (!Array.isArray(d.highlights) || d.highlights.length < 2 || d.highlights.length > 4) p.push("destacados: entre 2 y 4");
  return [...p, ...checkText(JSON.stringify(d))];
}

/** Reglas de cualquier texto que ve el cliente: sin links, mails, teléfonos ni promesas, y con voseo. */
export function checkText(text: string): string[] {
  const p: string[] = [];
  if (FORBIDDEN.test(text)) p.push(`texto prohibido: ${text.match(FORBIDDEN)![0]}`);
  if (/\b(tú|tienes|puedes|quieres|contáctanos|agenda tu)\b/i.test(text)) p.push("no usa voseo");
  return p;
}

/** WhatsApp solo si es celular argentino (+54 9 ...); si no, botón de llamada. */
export function contactLinks(phone: string | null, message: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return { whatsappUrl: null, callUrl: null };
  if (digits.startsWith("549") && digits.length >= 12) return { whatsappUrl: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`, callUrl: `tel:+${digits}` };
  return { whatsappUrl: null, callUrl: `tel:+${digits}` };
}

/** Código de la URL de la demo: aleatorio y no adivinable (PLAN 11). */
export function newSlug() {
  return randomBytes(8).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10).padEnd(10, "0");
}

/** Teléfono para mostrar: "+542215388440" → "(221) 538-8440".
 *  shortcut: solo arma el formato para la característica 221 (Gran La Plata) y 11 (AMBA); las demás quedan como vienen. Sumarlas al ampliar la zona. */
export function displayPhone(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^54(9)?/, "");
  const m = d.match(/^(221)(\d{3})(\d{4})$/) ?? d.match(/^(11)(\d{4})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
}
