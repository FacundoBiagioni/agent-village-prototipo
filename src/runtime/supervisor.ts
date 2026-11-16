// El Encargado (PLAN 6.6, versión inicial, código común): frena tareas duplicadas y por límite diario,
// reintenta una vez lo que falló por algo pasajero y avisa por Telegram lo que necesita al usuario.
import { and, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendText } from "@/telegram/bot";
import { backgroundShouldStop } from "@/village/energy";
import { getEnergy } from "./energy";
import { median } from "./eta";
import { enqueue } from "./queue";
import { emit } from "./record";
import { isTransient, overDailyLimit, sameTask, startOfDayAR } from "./supervisor-rules";

const { agentRuns, agentEvents, settings } = schema;
const STUCK_MIN_MS = 10 * 60_000;
const LOOKBACK_MS = 24 * 3_600_000;
const DOUBLE_MS = 2 * 60_000; // ventana del "doble clic"

/** Límites diarios por tarea ("agente/tarea" → máximo por día; 0 = pausada). Se editan en el panel del Encargado. */
// Límites de partida (usuario, 2026-11-07: plantillas con Opus, con tope diario). Lo que guarde el usuario en el panel manda.
const DEFAULT_LIMITS: Record<string, number> = { "disenador/crear_plantilla": 3 };

export async function getQuotaLimits(): Promise<Record<string, number>> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "quota_limits"));
  return { ...DEFAULT_LIMITS, ...((row?.value as Record<string, number>) ?? {}) };
}

export async function setQuotaLimit(key: string, limit: number | null) {
  const limits = await getQuotaLimits();
  if (limit == null) delete limits[key];
  else limits[key] = limit;
  await db.insert(settings).values({ key: "quota_limits", value: limits }).onConflictDoUpdate({ target: settings.key, set: { value: limits } });
}

/** Antes de empezar una tarea: ¿hay que frenarla? Devuelve el motivo, o null si puede seguir. */
export async function guardRun(run: { id: string; agentId: string; taskType: string; input: unknown; createdAt: Date }) {
  // Duplicada: la misma tarea pedida antes que esta y que sigue en curso, o que se pidió hace menos de 2 minutos y no falló
  // (un doble clic: como el worker hace una por vez, cuando esta arranca la primera puede haber terminado).
  const twins = await db
    .select({ id: agentRuns.id, agentId: agentRuns.agentId, taskType: agentRuns.taskType, input: agentRuns.input, status: agentRuns.status, createdAt: agentRuns.createdAt })
    .from(agentRuns)
    .where(and(eq(agentRuns.agentId, run.agentId), eq(agentRuns.taskType, run.taskType), ne(agentRuns.id, run.id), lt(agentRuns.createdAt, run.createdAt), gte(agentRuns.createdAt, new Date(run.createdAt.getTime() - DOUBLE_MS)), inArray(agentRuns.status, ["working", "waiting_approval", "queued", "done"])));
  if (twins.some((t) => sameTask(t, run))) return "Duplicada: la misma tarea se pidió recién (el Encargado la frenó para no gastar dos veces)";
  const running = await db
    .select({ id: agentRuns.id, agentId: agentRuns.agentId, taskType: agentRuns.taskType, input: agentRuns.input })
    .from(agentRuns)
    .where(and(eq(agentRuns.agentId, run.agentId), eq(agentRuns.taskType, run.taskType), ne(agentRuns.id, run.id), lt(agentRuns.createdAt, run.createdAt), inArray(agentRuns.status, ["working", "waiting_approval"])));
  if (running.some((t) => sameTask(t, run))) return "Duplicada: la misma tarea ya está en curso (el Encargado la frenó para no gastar dos veces)";
  // Límite diario de la tarea.
  const limit = (await getQuotaLimits())[`${run.agentId}/${run.taskType}`];
  if (limit != null) {
    const [today] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(agentRuns)
      .where(and(eq(agentRuns.agentId, run.agentId), eq(agentRuns.taskType, run.taskType), ne(agentRuns.id, run.id), gte(agentRuns.startedAt, startOfDayAR()), ne(agentRuns.status, "rejected")));
    if (overDailyLimit(today.n, limit)) return limit === 0 ? "Tarea pausada por el límite diario (0)" : `Límite diario alcanzado (${limit} por día): el Encargado la frenó`;
  }
  return null;
}

/** Ejecuciones que el Encargado ya atendió (para no avisar ni reintentar dos veces). */
async function handled(kind: "supervisor_alert" | "supervisor_retry", runIds: string[]) {
  if (runIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ id: sql<string>`${agentEvents.payload}->>'runId'` })
    .from(agentEvents)
    .where(and(eq(agentEvents.type, kind), inArray(sql`${agentEvents.payload}->>'runId'`, runIds)));
  return new Set(rows.map((r) => r.id));
}

async function alert(run: { id: string; agentId: string; taskType: string }, kind: "stuck" | "failed", text: string) {
  await emit("encargado", null, "supervisor_alert", { runId: run.id, agentId: run.agentId, taskType: run.taskType, kind, text });
  await sendText(`Encargado: ${text}`).catch((e) => console.error("[telegram]", String(e)));
}

export type SuperviseResult = { stuck: number; retried: number; alerted: number };

/** Revisión periódica: trabados, fallas recientes. */
export async function supervise(): Promise<SuperviseResult> {
  const now = Date.now();
  const out: SuperviseResult = { stuck: 0, retried: 0, alerted: 0 };

  // 1. Trabados: trabajando hace más del triple de lo normal (y más de 10 min).
  const working = await db.select().from(agentRuns).where(eq(agentRuns.status, "working"));
  const alertedStuck = await handled("supervisor_alert", working.map((r) => r.id));
  for (const r of working) {
    if (!r.startedAt || alertedStuck.has(r.id)) continue;
    const past = await db.select({ d: agentRuns.durationMs }).from(agentRuns).where(and(eq(agentRuns.agentId, r.agentId), eq(agentRuns.taskType, r.taskType), eq(agentRuns.status, "done"))).limit(20);
    const med = median(past.map((p) => p.d ?? 0)) ?? 0;
    const elapsed = now - r.startedAt.getTime();
    if (elapsed > Math.max(STUCK_MIN_MS, 3 * med)) {
      out.stuck++;
      out.alerted++;
      await alert(r, "stuck", `${r.agentId} lleva ${Math.round(elapsed / 60_000)} min con "${r.taskType}" (lo normal es ~${Math.max(1, Math.round(med / 60_000))} min). Puede estar trabado.`);
    }
  }

  // 2. Fallas de las últimas 24 h: un reintento si fue algo pasajero; si no, aviso.
  const failed = await db.select().from(agentRuns).where(and(eq(agentRuns.status, "failed"), gte(agentRuns.finishedAt, new Date(now - LOOKBACK_MS))));
  const ids = failed.map((r) => r.id);
  const [retriedSet, alertedSet] = await Promise.all([handled("supervisor_retry", ids), handled("supervisor_alert", ids)]);
  const lowEnergy = backgroundShouldStop(await getEnergy());
  for (const r of failed) {
    if (retriedSet.has(r.id) || alertedSet.has(r.id)) continue;
    const input = (r.input ?? {}) as Record<string, unknown>;
    const isRetry = typeof input.retryOf === "string";
    if (isTransient(r.error) && !isRetry && !(lowEnergy && r.brain === "claude")) {
      const [again] = await db
        .insert(agentRuns)
        .values({ agentId: r.agentId, taskType: r.taskType, brain: r.brain, model: r.model, stepsTotal: r.stepsTotal, input: { ...input, retryOf: r.id } })
        .returning({ id: agentRuns.id });
      await emit("encargado", null, "supervisor_retry", { runId: r.id, newRunId: again.id, agentId: r.agentId, taskType: r.taskType });
      await emit(r.agentId, again.id, "queued", { retryOf: r.id });
      await enqueue({ runId: again.id });
      out.retried++;
      continue;
    }
    out.alerted++;
    await alert(r, "failed", `${r.agentId} no pudo con "${r.taskType}"${isRetry ? " (ni con el reintento)" : ""}: ${(r.error ?? "sin detalle").slice(0, 200)}`);
  }
  if (out.retried || out.alerted) await emit("encargado", null, "supervisor_check", out);
  return out;
}
