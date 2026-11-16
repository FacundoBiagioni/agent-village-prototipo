// Energía = cuota real de Claude Pro (PLAN 9.5). La lee el SDK en cada llamada (mensaje "rate_limit_event").
// Visto el 2026-11-05: trae "unifiedWindows" con five_hour y seven_day, utilization de 0 a 1 y resetsAt en segundos.

export type Window = { usedPct: number; resetsAt: number | null }; // resetsAt en ms
export type EnergyReading = { fiveHour?: Window; sevenDay?: Window; rejected: boolean; overage: boolean; at: number };

// Límites del modo producción: paran antes de dejarte sin cuota para tu propio uso.
// shortcut: valores iniciales recomendados; ajustarlos con lo que midan los informes del modo producción.
export const BACKGROUND_LIMITS = { fiveHourPct: 80, sevenDayPct: 70 } as const;

type RawWindow = { utilization?: number | null; resetsAt?: number | null };
type RawInfo = { status?: string; utilization?: number; resetsAt?: number; rateLimitType?: string; isUsingOverage?: boolean; unifiedWindows?: Record<string, RawWindow> };

const pct = (u: number) => Math.round((u <= 1 ? u * 100 : u) * 10) / 10; // de 0-1 a %; si ya viene en %, se deja
const win = (w?: RawWindow): Window | undefined =>
  w?.utilization == null ? undefined : { usedPct: pct(w.utilization), resetsAt: w.resetsAt ? w.resetsAt * 1000 : null };

/** Convierte el rate_limit_info del SDK. Sin "unifiedWindows" usa la ventana que traiga suelta. */
export function parseRateLimit(info: RawInfo, now = Date.now()): EnergyReading {
  const loose = info.rateLimitType && info.utilization != null ? { [info.rateLimitType]: { utilization: info.utilization, resetsAt: info.resetsAt } } : {};
  const w = { ...loose, ...info.unifiedWindows };
  return { fiveHour: win(w.five_hour), sevenDay: win(w.seven_day), rejected: info.status === "rejected", overage: !!info.isUsingOverage, at: now };
}

/** Lo usado en una ventana; si ya se reinició desde la lectura, cuenta como 0. */
const used = (w: Window | undefined, now: number) => (!w || (w.resetsAt != null && w.resetsAt <= now) ? 0 : w.usedPct);

/** Energía de 0 a 100: lo que queda en la ventana más gastada. null = todavía no hubo lecturas. */
export function energyLevel(r: EnergyReading | null, now = Date.now()) {
  if (!r) return null;
  const reset = (w?: Window) => w?.resetsAt != null && w.resetsAt <= now;
  if (r.rejected && !reset(r.fiveHour) && !reset(r.sevenDay)) return 0;
  return Math.max(0, Math.round(100 - Math.max(used(r.fiveHour, now), used(r.sevenDay, now))));
}

/** El modo producción para si se pasa de los límites, si Claude ya rechaza pedidos o si apareciera uso extra pago. */
export function backgroundShouldStop(r: EnergyReading | null, now = Date.now()) {
  if (!r) return false;
  if (r.overage) return true;
  if (energyLevel(r, now) === 0) return true;
  return used(r.fiveHour, now) >= BACKGROUND_LIMITS.fiveHourPct || used(r.sevenDay, now) >= BACKGROUND_LIMITS.sevenDayPct;
}
