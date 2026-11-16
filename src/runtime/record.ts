import { eq } from "drizzle-orm";
import { db, pool, schema } from "@/db";

const { agentRuns, agentEvents } = schema;

/** Guarda el evento (auditoría) y avisa en vivo a la interfaz por LISTEN/NOTIFY. */
export async function emit(agentId: string, runId: string | null, type: string, payload: object = {}) {
  const [e] = await db.insert(agentEvents).values({ agentId, runId, type, payload }).returning({ id: agentEvents.id });
  await pool.query("select pg_notify('agent_events', $1)", [JSON.stringify({ id: e.id, agentId, runId, type })]);
}

/** Al arrancar el worker (hay uno solo), lo que quedó en "working" lo cortó un reinicio: se marca fallido. */
export async function failOrphanRuns() {
  const runs = await db.select().from(agentRuns).where(eq(agentRuns.status, "working"));
  for (const run of runs) await finishRun(run, "failed", { error: "Cortada por un reinicio del worker" });
  return runs.length;
}

export async function finishRun(
  run: { id: string; agentId: string; startedAt: Date | null },
  status: "done" | "failed" | "rejected",
  fields: { output?: unknown; error?: string; brain?: "code" | "local" | "claude"; model?: string | null; usage?: unknown } = {},
) {
  const finishedAt = new Date();
  await db
    .update(agentRuns)
    .set({ ...fields, status, finishedAt, durationMs: run.startedAt ? finishedAt.getTime() - run.startedAt.getTime() : null })
    .where(eq(agentRuns.id, run.id));
  await emit(run.agentId, run.id, status, fields.error ? { error: fields.error } : {});
}
