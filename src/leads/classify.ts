// Reglas de código común (sin IA) para ubicar cada negocio en un rubro y saber si tiene web propia.

export type Niche = "dentist" | "beauty" | "architecture";
export const NICHES: Record<Niche, string> = { dentist: "Odontología", beauty: "Peluquería y estética", architecture: "Estudio de arquitectura" };

export function classifyNiche(p: { category?: string | null; hierarchy?: string[] | null; name: string }): Niche | null {
  const cat = `${p.category ?? ""} ${(p.hierarchy ?? []).join(" ")}`.toLowerCase();
  const name = p.name.toLowerCase();
  if (cat.includes("dent") || /odont|dental/.test(name)) return "dentist";
  if (cat.includes("architect") || /arquitect/.test(name)) return "architecture";
  // "Peluquería canina" y "estética vehicular" no son el rubro.
  if (/animal|pet|automotive|vehicle|car_/.test(cat) || /canin|mascota|perro|auto|veh[ií]c/.test(name)) return null;
  if (/hair|beauty|barber|nail/.test(cat) || /peluquer|barber|est[ée]tica|belleza|u[ñn]as/.test(name)) return "beauty";
  return null;
}

const SOCIAL = /(^|\.)(facebook|fb|instagram|wa|whatsapp|linktr|tiktok|twitter|x|youtube|linkedin)\.(com|me|ee)$/;
// Plataformas de turnos o perfiles: el negocio no tiene sitio propio (también es oportunidad).
const PLATFORMS = /(^|\.)(bewe\.co|agendapro\.com|booksy\.com|fresha\.com|doctoralia\.com\.ar|treatwell\.com)$/;

export function isSocialUrl(url: string) {
  try {
    const host = new URL(url.includes("://") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
    return SOCIAL.test(host) || PLATFORMS.test(host);
  } catch {
    return false;
  }
}

/** Sin web, solo redes, o con web propia todavía sin revisar. */
export function initialWebStatus(websites: string[]): "none" | "social_only" | "unchecked" {
  if (websites.length === 0) return "none";
  return websites.every(isSocialUrl) ? "social_only" : "unchecked";
}

export function normalizePhone(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/** Barbería (dentro de "Peluquería y estética"): lleva la paleta oscura. */
export function isBarbershop(p: { name: string; category?: string | null }) {
  return /barber/i.test(p.category ?? "") || /barber/i.test(p.name);
}

/** Teléfono cargado a mano ("221 555 1234", "0221 15 555-1234", "+54 9 ..."): sin el 9 no se distingue un celular de un fijo,
 *  así que se pregunta en el formulario. Devuelve el formato de Overture (+54 9 ... para celular) o null si no es un número argentino de 10 cifras. */
export function manualPhone(raw: string, mobile: boolean): string | null {
  let d = raw.replace(/\D/g, "").replace(/^54/, "").replace(/^9/, "").replace(/^0/, "");
  // El "15" de los celulares va después de la característica (2 a 4 cifras): se saca.
  if (d.length === 12) for (const at of [2, 3, 4]) if (d.slice(at, at + 2) === "15") { d = d.slice(0, at) + d.slice(at + 2); break; }
  if (d.length !== 10) return null;
  return mobile ? `+549${d}` : `+54${d}`;
}

/** Hospitales, clínicas grandes, universidades y entes públicos: no son clientes de una landing. */
export function isInstitution(p: { name: string; category?: string | null }) {
  return /^(hospital|college_university|community_and_government|public_service)/.test(p.category ?? "") || /\b(hospital|universidad|facultad|municipalidad|ministerio|instituto m[eé]dico)\b/i.test(p.name);
}
