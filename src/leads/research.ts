// Investigación del Analista (usuario, 2026-11-07): Claude busca en internet la presencia del negocio (web, Instagram,
// Facebook, Google Maps, otras redes) y el código valida lo que devuelve. Lo encontrado en la web es dato de terceros:
// acá solo se aceptan links con forma válida y públicos; Facebook y Maps quedan como links para que el usuario mire
// (bajar sus fotos va contra los términos de Meta y Google). Las fotos salen de la web propia e Instagram (API oficial).
import { instagramHandle, isPublicUrl } from "@/demos/brand";

export const RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    links: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["web", "instagram", "facebook", "google_maps", "tiktok", "linkedin", "whatsapp", "directorio", "otro"] },
          url: { type: "string" },
          why: { type: "string", maxLength: 200 },
        },
        required: ["kind", "url", "why"],
      },
    },
    notes: { type: "string", maxLength: 600 },
  },
  required: ["links", "notes"],
};

export type ResearchLink = { kind: string; url: string; why: string };
export type Research = { links: ResearchLink[]; notes: string; website: string | null; instagram: string | null; searchedAt: string };

const KINDS = new Set(["web", "instagram", "facebook", "google_maps", "tiktok", "linkedin", "whatsapp", "directorio", "otro"]);
const SOCIAL_HOST = /(^|\.)(facebook|fb|instagram|tiktok|linkedin|twitter|x|youtube|wa|whatsapp|google|goo|linktr|linktree|maps)\.[a-z.]+$/i;

/** Valida lo que devolvió Claude: solo links http(s) públicos, sin repetidos, con texto corto. Elige la web propia y el Instagram. */
export function cleanResearch(raw: unknown, now = new Date()): Research {
  const r = (raw ?? {}) as { links?: unknown; notes?: unknown };
  const seen = new Set<string>();
  const links: ResearchLink[] = [];
  for (const l of Array.isArray(r.links) ? r.links : []) {
    const { kind, url, why } = (l ?? {}) as Record<string, unknown>;
    if (typeof url !== "string" || !/^https?:\/\//i.test(url) || !isPublicUrl(url) || url.length > 300) continue;
    const key = url.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ kind: typeof kind === "string" && KINDS.has(kind) ? kind : "otro", url, why: typeof why === "string" ? why.slice(0, 200) : "" });
  }
  const website = links.find((l) => l.kind === "web" && !SOCIAL_HOST.test(new URL(l.url).hostname))?.url ?? null;
  const instagram = links.filter((l) => l.kind === "instagram").map((l) => instagramHandle(l.url)).find(Boolean) ?? null;
  return { links, notes: typeof r.notes === "string" ? r.notes.slice(0, 600) : "", website, instagram, searchedAt: now.toISOString() };
}

// Palabras del rubro o de la zona: no sirven para reconocer a un negocio entre otros parecidos.
const GENERIC = new Set(
  "odontologia odontologica odontologico odontologicos consultorio consultorios dental dentista dentistas estudio centro clinica integral salud sonrisa peluqueria peluqueros barberia barber barbershop estetica belleza spa salon unisex arquitectura arquitectos arquitecto diseno la plata platense del las los para con".split(" "),
);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** ¿La cuenta de Instagram que encontró la búsqueda es de este negocio? Por el nombre (sin palabras genéricas) o el teléfono. */
export function instagramMatches(business: { name: string; phone: string | null }, profile: { username: string; name?: string | null; bio?: string | null }) {
  const hay = norm(`${profile.username} ${profile.name ?? ""} ${profile.bio ?? ""}`);
  const compactHay = hay.replace(/[^a-z0-9]/g, "");
  const tokens = norm(business.name).split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !GENERIC.has(t));
  if (tokens.some((t) => compactHay.includes(t))) return true;
  // Nombre hecho solo de palabras genéricas ("Odontología MM"): tiene que aparecer completo dentro de un mismo campo
  // (si se juntan los campos, "Odontología" del nombre y "MM" de la biografía darían una coincidencia falsa).
  const compactName = norm(business.name).replace(/[^a-z0-9]/g, "");
  const fields = [profile.username, profile.name ?? "", profile.bio ?? ""].map((f) => norm(f).replace(/[^a-z0-9]/g, ""));
  if (tokens.length === 0 && compactName.length >= 6 && fields.some((f) => f.includes(compactName))) return true;
  const phone = (business.phone ?? "").replace(/\D/g, "").slice(-8);
  return phone.length === 8 && hay.replace(/\D/g, "").includes(phone);
}

const kindOf = (url: string) => {
  const h = new URL(url).hostname;
  return /instagram\./.test(h) ? "instagram" : /(facebook|fb)\./.test(h) ? "facebook" : /tiktok\./.test(h) ? "tiktok" : /linkedin\./.test(h) ? "linkedin" : /(wa\.me|whatsapp\.)/.test(h) ? "whatsapp" : "web";
};

/** Suma a la investigación los links que ya se conocían (Overture) y el de Google Maps, sin repetir. Recalcula web e Instagram. */
export function withKnownLinks(r: Research, known: string[], mapsUrl: string): Research {
  const extra = [
    ...known.map((url) => ({ kind: url.includes("://") ? kindOf(url) : "web", url: url.includes("://") ? url : `https://${url}`, why: "Ya figuraba en los datos de Overture" })),
    ...(r.links.some((l) => l.kind === "google_maps") ? [] : [{ kind: "google_maps", url: mapsUrl, why: "Búsqueda en Google Maps por nombre y dirección" }]),
  ];
  const merged = cleanResearch({ links: [...r.links, ...extra], notes: r.notes }, new Date(r.searchedAt));
  return merged;
}
