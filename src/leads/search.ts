import { and, between, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isInstitution, normalizePhone, type Niche } from "./classify";
import { distanceKm, opportunityScore } from "./score";

const { leads, doNotContact } = schema;

// Centro por defecto: Plaza Moreno, La Plata.
export const DEFAULT_CENTER = { lat: -34.9214, lng: -57.9545 };
export const MAX_RADIUS_KM = 10;

export async function searchLeads(q: { niche: Niche; lat: number; lng: number; radiusKm: number }) {
  const radiusKm = Math.min(Math.max(q.radiusKm, 0.5), MAX_RADIUS_KM);
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((q.lat * Math.PI) / 180));
  const [rows, blocked] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.niche, q.niche),
          ne(leads.stage, "do_not_contact"),
          // Si Overture dejó de listar un negocio sin trabajar (cerró), no se ofrece más. Los ya trabajados se ven siempre.
          // shortcut: max() de texto sirve mientras la release termine en .0–.9 (formato AAAA-MM-DD.N de Overture).
          sql`(${leads.source} <> 'overture' or ${leads.stage} not in ('found', 'analyzed') or ${leads.seenInRelease} = (select max(seen_in_release) from leads where source = 'overture'))`,
          between(leads.lat, q.lat - dLat, q.lat + dLat),
          between(leads.lng, q.lng - dLng, q.lng + dLng),
        ),
      ),
    db.select({ leadId: doNotContact.leadId, phone: doNotContact.phone }).from(doNotContact),
  ]);
  const blockedIds = new Set(blocked.map((b) => b.leadId));
  const blockedPhones = new Set(blocked.map((b) => b.phone).filter(Boolean));

  const byPhone = new Map<string, ReturnType<typeof enrich>>();
  const out: ReturnType<typeof enrich>[] = [];
  function enrich(l: (typeof rows)[number]) {
    const d = distanceKm(q.lat, q.lng, l.lat, l.lng);
    return { ...l, distanceKm: d, score: opportunityScore({ ...l, distanceKm: d, radiusKm }) };
  }
  for (const l of rows) {
    const phone = normalizePhone(l.phone);
    if (blockedIds.has(l.id) || (phone && blockedPhones.has(phone)) || isInstitution(l)) continue;
    const e = enrich(l);
    if (e.distanceKm > radiusKm) continue;
    if (!phone) {
      out.push(e);
      continue;
    }
    // Mismo teléfono = mismo negocio cargado dos veces: queda el de mayor puntaje.
    const prev = byPhone.get(phone);
    if (!prev || prev.score < e.score) byPhone.set(phone, e);
  }
  const results = [...out, ...byPhone.values()].sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
  return { radiusKm, results };
}

/** Link oficial de Google Maps (URL pública, sin clave ni costo) para mirar reseñas a mano. */
export function googleMapsUrl(l: { name: string; address: string | null; lat: number; lng: number }) {
  const query = l.address ? `${l.name}, ${l.address}` : `${l.name} ${l.lat},${l.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Saca las coordenadas de un link de Google Maps (formatos "@lat,lng", "!3dlat!4dlng" o "q=lat,lng"). */
export function coordsFromMapsUrl(url: string): { lat: number; lng: number } | null {
  const m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ?? url.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
