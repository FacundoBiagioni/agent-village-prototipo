import { and, eq } from "drizzle-orm";
import { getTask } from "@/agents";
import { db, schema } from "@/db";
import { emit, finishRun } from "./record";

const { agentRuns, approvals } = schema;

export async function requestApproval(run: { id: string; agentId: string }, actionType: string, payload: unknown) {
  const [a] = await db.insert(approvals).values({ runId: run.id, agentId: run.agentId, actionType, payload }).returning();
  await db.update(agentRuns).set({ status: "waiting_approval", output: payload, stepLabel: "Esperando aprobación" }).where(eq(agentRuns.id, run.id));
  await emit(run.agentId, run.id, "waiting_approval", { approvalId: a.id, actionType });
  return a;
}

/** Decisión del usuario en la bandeja. Solo pasa de "pending" a la decisión, una vez. */
export async function decideApproval(id: string, decision: "approved" | "rejected") {
  const [a] = await db
    .update(approvals)
    .set({ status: decision, decidedAt: new Date() })
    .where(and(eq(approvals.id, id), eq(approvals.status, "pending")))
    .returning();
  if (!a) throw new Error("La aprobación no existe o ya fue decidida");
  if (decision === "rejected") {
    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, a.runId));
    await getTask(run.agentId, run.taskType).external?.onReject?.(a.payload);
    await finishRun(run, "rejected");
  }
  return a;
}

/** Único camino para ejecutar una acción hacia afuera: exige una aprobación "approved" en la base. */
export async function executeApproved(approvalId: string) {
  const [a] = await db.select().from(approvals).where(eq(approvals.id, approvalId));
  if (!a || a.status !== "approved") throw new Error("Acción hacia afuera sin aprobación: bloqueada");
  // Se valida la tarea ANTES de tomarla: si falla acá, la tarea no queda trabada en "trabajando".
  const [pending] = await db.select().from(agentRuns).where(eq(agentRuns.id, a.runId));
  const task = getTask(pending.agentId, pending.taskType);
  if (!task.external) throw new Error("La tarea no tiene acción hacia afuera");
  // Cambio atómico: si dos procesos lo intentan, solo uno ejecuta.
  const [run] = await db
    .update(agentRuns)
    // Hora de inicio nueva: la espera de tu aprobación no cuenta como trabajo (si no, el Encargado lo ve "trabado" y los tiempos normales se inflan).
    .set({ status: "working", stepLabel: "Ejecutar", startedAt: new Date() })
    .where(and(eq(agentRuns.id, a.runId), eq(agentRuns.status, "waiting_approval")))
    .returning();
  if (!run) throw new Error("La acción ya se ejecutó o la tarea no espera aprobación");
  try {
    const result = await task.external.execute(a.payload);
    await finishRun(run, "done", { output: { payload: a.payload, result } });
  } catch (err) {
    await finishRun(run, "failed", { error: String(err) });
  }
}
