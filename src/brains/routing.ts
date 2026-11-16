// Ruteo al cerebro más barato que hace bien cada tarea (PLAN 6.6, Fase 6). Funciones puras: los datos vienen de agent_events.
// Cada etapa tiene su cerebro de siempre (el "base", probado) y, opcional, escalones más baratos para probar.
// Un escalón barato se gana su lugar con resultados: si aprueba seguido, pasa a ser el primero; si falla, se escala al siguiente.
import type { Brain } from "@/agents/types";

export type Rung = { brain: Brain; model?: string };
export type RungStats = { tries: number; ok: number };

/** Con 5 intentos y 80 % aprobados, el escalón barato pasa a ser el primero. */
export const PROMOTE = { minTries: 5, okRate: 0.8 };
/** Mientras se decide, 1 de cada 3 pedidos prueba el escalón barato (el resto va directo al de siempre). */
export const PROBE_EVERY = 3;
/** Uno que no pasó la prueba se vuelve a probar de vez en cuando (los modelos mejoran). */
export const RETRY_DEMOTED_EVERY = 20;
/** Intentos que cuentan para las estadísticas de cada escalón (los más recientes). */
export const WINDOW = 10;

export const rungKey = (r: Rung) => `${r.brain}:${r.model ?? ""}`;

type Verdict = "promoted" | "demoted" | "undecided";
export function verdict(s: RungStats | undefined): Verdict {
  if (!s || s.tries < PROMOTE.minTries) return "undecided";
  return s.ok / s.tries >= PROMOTE.okRate ? "promoted" : "demoted";
}

/** Escalones a intentar en orden. `cheaper` va del más barato al más caro; el último siempre es el base.
 *  `asked`: cuántas veces se pidió esta etapa antes (decide los turnos de prueba). */
export function plan(cheaper: Rung[], base: Rung, stats: (r: Rung) => RungStats | undefined, asked: number): Rung[] {
  const start = cheaper.findIndex((r) => verdict(stats(r)) === "promoted");
  const from = start < 0 ? cheaper.length : start;
  // Prueba, antes del primero, un escalón todavía más barato que esté en duda (o uno descartado, muy de vez en cuando).
  const probe = cheaper.slice(0, from).find((r) => {
    const v = verdict(stats(r));
    return (v === "undecided" && asked % PROBE_EVERY === 0) || (v === "demoted" && asked % RETRY_DEMOTED_EVERY === 0);
  });
  return [...(probe ? [probe] : []), ...cheaper.slice(from), base];
}

/** Estadísticas por escalón con los intentos más recientes primero. */
export function statsOf(attempts: { rung: string; ok: boolean }[]): Map<string, RungStats> {
  const out = new Map<string, RungStats>();
  for (const a of attempts) {
    const s = out.get(a.rung) ?? { tries: 0, ok: 0 };
    if (s.tries >= WINDOW) continue;
    s.tries++;
    if (a.ok) s.ok++;
    out.set(a.rung, s);
  }
  return out;
}

export type Attempt = { rung: string; ok: boolean; costUsd: number; quotaPct: number };

/** Ahorro medible: lo que costó lo resuelto con un escalón barato contra lo que cuesta en promedio el base,
 *  menos lo gastado en pruebas que no sirvieron. En dólares estimados y en % de la ventana de 5 horas. */
export function savings(attempts: Attempt[], base: string) {
  const baseOk = attempts.filter((a) => a.rung === base && a.ok);
  const avg = (k: "costUsd" | "quotaPct") => (baseOk.length ? baseOk.reduce((s, a) => s + a[k], 0) / baseOk.length : null);
  const baseUsd = avg("costUsd");
  const basePct = avg("quotaPct");
  let usd = 0;
  let pct = 0;
  let cheapOk = 0;
  for (const a of attempts) {
    if (a.rung === base) continue;
    if (a.ok) {
      cheapOk++;
      usd += (baseUsd ?? a.costUsd) - a.costUsd;
      pct += (basePct ?? a.quotaPct) - a.quotaPct;
    } else {
      usd -= a.costUsd;
      pct -= a.quotaPct;
    }
  }
  return { cheapOk, usd: Math.round(usd * 1000) / 1000, quotaPct: Math.round(pct * 10) / 10, measured: baseUsd != null };
}
