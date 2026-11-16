// Reglas del Encargado (PLAN 6.6, versión inicial): funciones puras, sin base de datos.
import type { EnergyReading } from "@/village/energy";

/** Errores que suelen arreglarse solos (red, tiempo agotado, servicio saturado, reinicio): vale la pena un reintento. */
const TRANSIENT = /timeout|timed out|aborted|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up|overloaded|\b5\d\d\b|Cortada por un reinicio/i;
export const isTransient = (error: string | null | undefined) => !!error && TRANSIENT.test(error);

// Claves del input que no cambian qué tarea es (de dónde vino, si era del modo producción, si es un reintento).
const META = new Set(["from", "background", "retryOf", "fakeTest"]);
const canonical = (input: unknown) =>
  JSON.stringify(
    Object.entries((input ?? {}) as Record<string, unknown>)
      .filter(([k]) => !META.has(k))
      .sort(([a], [b]) => a.localeCompare(b)),
  );

/** Misma tarea = mismo agente, mismo tipo y mismos datos (sin contar de dónde vino). */
export function sameTask(a: { agentId: string; taskType: string; input: unknown }, b: { agentId: string; taskType: string; input: unknown }) {
  return a.agentId === b.agentId && a.taskType === b.taskType && canonical(a.input) === canonical(b.input);
}

/** Cuánto de la ventana de 5 horas gastó una llamada a Claude: la diferencia con la lectura anterior.
 *  shortcut: aproximado (el SDK informa el uso al empezar la respuesta, así que puede correrse una llamada); sirve para comparar tareas. */
export function quotaSpend(prev: EnergyReading | null, next: EnergyReading): number | null {
  const a = prev?.fiveHour;
  const b = next.fiveHour;
  if (!b) return null;
  if (!a || a.resetsAt !== b.resetsAt) return b.usedPct; // ventana nueva: todo lo usado es de ahora
  return Math.max(0, Math.round((b.usedPct - a.usedPct) * 10) / 10);
}

/** Consumo de Claude de una ejecución, venga en una sola etapa o en varias (usage puede ser objeto o lista). */
export function claudeUsage(usage: unknown): { quotaPct: number; costUsd: number; calls: number } {
  const parts: unknown[] = Array.isArray(usage) ? usage.filter((u) => (u as { brain?: string })?.brain === "claude").map((u) => (u as { usage?: unknown }).usage) : usage ? [usage] : [];
  let quotaPct = 0;
  let costUsd = 0;
  let calls = 0;
  for (const p of parts) {
    const u = p as { quotaPct5h?: number | null; estimatedCostUsd?: number } | null;
    if (!u || (u.estimatedCostUsd == null && u.quotaPct5h == null)) continue;
    calls++;
    quotaPct += u.quotaPct5h ?? 0;
    costUsd += u.estimatedCostUsd ?? 0;
  }
  return { quotaPct: Math.round(quotaPct * 10) / 10, costUsd, calls };
}

/** Inicio del día en Argentina (UTC-3, sin horario de verano) para contar "por día". */
export function startOfDayAR(now = new Date()) {
  const ar = new Date(now.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate()) + 3 * 3_600_000);
}

/** ¿Llegó al límite diario? null = sin límite. */
export const overDailyLimit = (doneToday: number, limit: number | null | undefined) => limit != null && limit >= 0 && doneToday >= limit;
