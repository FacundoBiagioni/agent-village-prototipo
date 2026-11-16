import { and, eq } from "drizzle-orm";
import { getTask } from "@/agents";
import type { AskResult } from "@/agents/types";
import { ask } from "@/brains";
import { db, schema } from "@/db";
import { notifyApproval } from "@/telegram/bot";
import { requestApproval } from "./approvals";
import { emit, finishRun } from "./record";
import { routeFor } from "./routing";
import { guardRun } from "./supervisor";
import { AURA_AGENT, getEquipment, skillBody } from "./skills";
import { extraSkills } from "./skills-rules";

const { agentRuns } = schema;

/** Bucle estándar (PLAN 7.3): tomar, ejecutar con progreso, registrar resultado, tiempos y consumo. */
export async function executeRun(runId: string) {
  const startedAt = new Date();
  // Solo un worker toma cada tarea en cola.
  const [run] = await db
    .update(agentRuns)
    .set({ status: "working", startedAt })
    .where(and(eq(agentRuns.id, runId), eq(agentRuns.status, "queued")))
    .returning();
  if (!run) return;
  // El Encargado frena duplicadas y tareas que pasaron su límite diario, antes de gastar nada.
  const blocked = await guardRun(run);
  if (blocked) {
    await finishRun(run, "rejected", { error: blocked });
    await emit("encargado", null, "supervisor_blocked", { runId: run.id, agentId: run.agentId, taskType: run.taskType, brain: run.brain, reason: blocked });
    return;
  }
  await emit(run.agentId, run.id, "working");

  let last: AskResult | undefined;
  const usage: { brain: string; model?: string; usage?: unknown }[] = [];
  try {
    const task = getTask(run.agentId, run.taskType);
    // Skills equipadas (PLAN 8): las del agente y el aura del Encargado, además de las fijas de la tarea.
    const equipment = await getEquipment();
    const extras = extraSkills({ own: equipment[run.agentId] ?? [], aura: equipment[AURA_AGENT] ?? [], fixed: task.equippedSkills ?? [] });
    const bodies = await Promise.all(extras.map(skillBody));
    const extraText = extras.length ? ["", "---", "Skills equipadas (aplicalas si corresponden a esta tarea):", "", bodies.join("\n\n---\n\n")].join("\n") : "";
    const output = await task.run({
      input: run.input as Record<string, unknown>,
      async skill(name) {
        if (!task.equippedSkills?.includes(name) && !extras.includes(name)) throw new Error(`Skill no equipada: ${name}`);
        return skillBody(name);
      },
      async step(label) {
        const stepIndex = task.steps.indexOf(label) + 1;
        await db.update(agentRuns).set({ stepIndex, stepLabel: label }).where(eq(agentRuns.id, run.id));
        await emit(run.agentId, run.id, "progress", { stepIndex, stepsTotal: task.steps.length, label });
      },
      async ask(prompt, opts) {
        const withSkills = extraText ? { ...opts, system: `${opts?.system ?? ""}${extraText}` } : opts;
        // Ruteo (Fase 6): cada intento, también los que se descartan al escalar, suma al consumo de la ejecución.
        const route = await routeFor(run, opts?.stage, (r) => usage.push({ brain: r.brain, model: r.model, usage: r.usage }));
        last = await ask(task, prompt, withSkills, (err) => emit(run.agentId, run.id, "fallback", { error: String(err), stage: opts?.stage }), route);
        return last;
      },
    });
    if (task.external) {
      const approval = await requestApproval(run, task.external.actionType, output);
      await notifyApproval(approval).catch((e) => console.error("[telegram]", String(e))); // si Telegram falla, queda igual en la bandeja web
      return;
    }
    await finishRun(run, "done", { output, brain: usage.length > 1 ? run.brain : last?.brain, model: usage.length > 1 ? run.model : last?.model ?? run.model, usage: usage.length > 1 ? usage : last?.usage });
  } catch (err) {
    await finishRun(run, "failed", { error: String(err), usage: usage.length ? usage : undefined });
  }
}
