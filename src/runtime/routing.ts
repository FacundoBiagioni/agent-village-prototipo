// Datos del ruteo de cerebros (src/brains/routing.ts): cada intento es un evento "brain_attempt" en agent_events.
import { and, desc, eq, sql } from "drizzle-orm";
import type { AskResult } from "@/agents/types";
import type { AttemptInfo, Route } from "@/brains";
import { rungKey, statsOf, type Rung } from "@/brains/routing";
import { db, schema } from "@/db";
import { emit } from "./record";
import { claudeUsage } from "./supervisor-rules";

const { agentEvents } = schema;
export type AttemptPayload = { key: string; rung: string; ok: boolean; reason?: string; first: boolean; costUsd: number; quotaPct: number };

/** Etapa de una tarea: "agente/tarea/etapa" ("-" si la tarea no tiene etapas). */
export const stageKey = (agentId: string, taskType: string, stage?: string) => `${agentId}/${taskType}/${stage ?? "-"}`;

export async function attemptsOf(key: string, limit = 300): Promise<AttemptPayload[]> {
  const rows = await db
    .select({ p: agentEvents.payload })
    .from(agentEvents)
    .where(and(eq(agentEvents.type, "brain_attempt"), sql`${agentEvents.payload}->>'key' = ${key}`))
    .orderBy(desc(agentEvents.id))
    .limit(limit);
  return rows.map((r) => r.p as AttemptPayload);
}

/** Lo que necesita el router para una etapa: estadísticas por escalón, cuántas veces se pidió y dónde anotar cada intento. */
export async function routeFor(run: { id: string; agentId: string; taskType: string }, stage: string | undefined, onResult: (r: AskResult) => void): Promise<Route> {
  const key = stageKey(run.agentId, run.taskType, stage);
  const attempts = await attemptsOf(key);
  const stats = statsOf(attempts);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(agentEvents)
    .where(and(eq(agentEvents.type, "brain_attempt"), sql`${agentEvents.payload}->>'key' = ${key}`, sql`(${agentEvents.payload}->>'first')::boolean`));
  return {
    stats: (r: Rung) => stats.get(rungKey(r)),
    asked: n,
    async onAttempt(a: AttemptInfo) {
      if (a.result) onResult(a.result);
      const u = a.result?.brain === "claude" ? claudeUsage(a.result.usage) : { costUsd: 0, quotaPct: 0 };
      const payload: AttemptPayload = { key, rung: a.rung, ok: a.ok, reason: a.reason, first: a.first, costUsd: u.costUsd, quotaPct: u.quotaPct };
      await emit(run.agentId, run.id, "brain_attempt", payload);
    },
  };
}
