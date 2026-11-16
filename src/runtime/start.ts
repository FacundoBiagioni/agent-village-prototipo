import { db, schema } from "@/db";
import type { TaskConfig } from "@/agents/types";
import { enqueue } from "./queue";
import { emit } from "./record";

/** Crea la ejecución, la registra y la encola para el worker. Recibe la tarea para no importar el registro de agentes (evita ciclos). */
export async function startRun(agentId: string, taskType: string, task: TaskConfig, input: Record<string, unknown>) {
  const [run] = await db
    .insert(schema.agentRuns)
    .values({ agentId, taskType, brain: task.brain, model: task.model, stepsTotal: task.steps.length, input })
    .returning({ id: schema.agentRuns.id });
  await emit(agentId, run.id, "queued", input);
  await enqueue({ runId: run.id });
  return run.id;
}
