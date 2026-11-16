import type { AskOptions, AskResult, Brain, BrainConfig, TaskConfig } from "@/agents/types";
import { askClaude } from "./claude";
import { askLocal } from "./local";
import { plan, rungKey, type Rung, type RungStats } from "./routing";

function askWith(brain: Brain, model: string | undefined, think: boolean | undefined, prompt: string, opts: AskOptions, web?: boolean): Promise<AskResult> {
  if (brain === "code") throw new Error("Una tarea de código común no consulta a ningún modelo");
  if (!model) throw new Error(`Falta el modelo para el cerebro ${brain}`);
  if (web && brain !== "claude") throw new Error("Solo Claude puede buscar en internet");
  return brain === "local" ? askLocal(prompt, { model, schema: opts.schema, think, system: opts.system }) : askClaude(prompt, { model, schema: opts.schema, system: opts.system, web });
}

/** Cada intento queda registrado: qué escalón, si sirvió y lo que gastó (para el ruteo y el ahorro). */
export type AttemptInfo = { rung: string; ok: boolean; reason?: string; first: boolean; result?: AskResult };
export type Route = { stats: (r: Rung) => RungStats | undefined; asked: number; onAttempt: (a: AttemptInfo) => Promise<void> };

/** Router de cerebros: prueba primero el escalón más barato que corresponda (si la etapa tiene `cheaper` y hay datos del ruteo),
 *  escala si falla o si la tarea rechaza la respuesta, y si el de siempre falla pasa al fallback. */
export async function ask(task: TaskConfig, prompt: string, opts: AskOptions = {}, onFallback?: (err: unknown) => Promise<void>, route?: Route) {
  const cfg: BrainConfig = opts.stage ? task.stages?.[opts.stage] ?? fail(opts.stage) : task;
  const base: Rung = { brain: cfg.brain, model: cfg.model };
  const chain = route && cfg.cheaper?.length ? plan(cfg.cheaper, base, route.stats, route.asked) : [base];
  let first = true;
  const report = async (a: Omit<AttemptInfo, "first">) => {
    await route?.onAttempt({ ...a, first });
    first = false;
  };
  for (const rung of chain.slice(0, -1)) {
    // Escalón barato: si falla o la tarea no lo acepta, se sigue con el próximo.
    try {
      const r = await askWith(rung.brain, rung.model, cfg.think, prompt, opts, cfg.web);
      const reason = opts.accept?.(r) ?? null;
      await report({ rung: rungKey(rung), ok: !reason, reason: reason ?? undefined, result: r });
      if (!reason) return r;
    } catch (err) {
      await report({ rung: rungKey(rung), ok: false, reason: String(err).slice(0, 200) });
    }
  }
  try {
    const r = await askWith(cfg.brain, cfg.model, cfg.think, prompt, opts, cfg.web);
    const reason = opts.accept?.(r) ?? null;
    await report({ rung: rungKey(base), ok: !reason, reason: reason ?? undefined, result: r });
    return r; // el de siempre: si la tarea lo rechaza, lo decide la tarea (como antes)
  } catch (err) {
    await report({ rung: rungKey(base), ok: false, reason: String(err).slice(0, 200) });
    if (!cfg.fallback) throw err;
    await onFallback?.(err);
    const r = await askWith(cfg.fallback, cfg.fallbackModel, cfg.think, prompt, opts, cfg.web);
    await report({ rung: rungKey({ brain: cfg.fallback, model: cfg.fallbackModel }), ok: true, result: r });
    return r;
  }
}

function fail(stage: string): never {
  throw new Error(`Etapa sin configurar: ${stage}`);
}
