// Modo Visita (PLAN 10): lógica pura, sin base de datos, para poder probarla.
import { distanceKm } from "@/leads/score";

export type Point = { lat: number; lng: number };
export const RESULTS = ["interested", "come_back", "not_interested"] as const;
export type VisitResult = (typeof RESULTS)[number];

/** Ruta del día: desde el punto de partida, siempre al más cercano que falta (vecino más cercano).
 *  shortcut: no es el recorrido óptimo, pero con 5 a 15 paradas la diferencia es chica; cambiar si las rutas crecen. */
export function planRoute<T extends Point>(start: Point, candidates: T[], max: number): T[] {
  const left = [...candidates];
  const route: T[] = [];
  let at: Point = start;
  while (left.length && route.length < max) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (distanceKm(at.lat, at.lng, left[i].lat, left[i].lng) < distanceKm(at.lat, at.lng, left[best].lat, left[best].lng)) best = i;
    const next = left.splice(best, 1)[0];
    route.push(next);
    at = next;
  }
  return route;
}

/** Fecha de hoy en Argentina (AAAA-MM-DD). Con toISOString, después de las 21 ya sería "mañana" (UTC). */
export const todayAR = (now = new Date()) => now.toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });

/** Cómo cambia la etapa del negocio con una visita. Nunca retrocede (si ya cerró, sigue cerrado). */
const ORDER = ["found", "analyzed", "demo_created", "contacted", "replied"];
export function stageAfterVisit(stage: string, result: VisitResult, doNotContact: boolean): string {
  if (result === "not_interested") return doNotContact ? "do_not_contact" : ORDER.includes(stage) ? "lost" : stage;
  const target = result === "interested" ? "replied" : "contacted";
  return ORDER.includes(stage) && ORDER.indexOf(stage) < ORDER.indexOf(target) ? target : stage;
}

export type VisitInput = { clientId: string; leadId: string; demoId: string | null; result: VisitResult; note: string | null; comeBackOn: string | null; doNotContact: boolean; visitedAt: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lo que manda el celular viene de afuera del servidor: se valida campo por campo. Devuelve null si algo no cierra. */
export function parseVisit(v: unknown): VisitInput | null {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const { clientId, leadId, demoId, result, note, comeBackOn, doNotContact, visitedAt } = o;
  if (typeof clientId !== "string" || !/^[\w-]{8,64}$/.test(clientId)) return null;
  if (typeof leadId !== "string" || !UUID.test(leadId)) return null;
  if (demoId != null && (typeof demoId !== "string" || !UUID.test(demoId))) return null;
  if (!RESULTS.includes(result as VisitResult)) return null;
  if (note != null && (typeof note !== "string" || note.length > 2000)) return null;
  if (comeBackOn != null && (typeof comeBackOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(comeBackOn))) return null;
  const when = typeof visitedAt === "string" ? Date.parse(visitedAt) : NaN;
  if (Number.isNaN(when) || when > Date.now() + 86_400_000) return null;
  return {
    clientId,
    leadId,
    demoId: (demoId as string | null) ?? null,
    result: result as VisitResult,
    note: (note as string | null)?.trim() || null,
    comeBackOn: result === "come_back" ? ((comeBackOn as string | null) ?? null) : null,
    doNotContact: result === "not_interested" && doNotContact === true,
    visitedAt: new Date(when).toISOString(),
  };
}
