// Modo producción (reemplaza al "turno noche", PLAN 16): el usuario lo prende cuando la PC va a quedar prendida sin usarla.
// Los agentes hacen las tareas guardadas ("scheduled") y paran al terminar, al quedarse sin energía o cuando el usuario lo apaga.
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendText } from "@/telegram/bot";
import { backgroundShouldStop, type EnergyReading, type Window } from "@/village/energy";
import { getEnergy } from "./energy";
import { enqueue } from "./queue";
import { reportText, type Report, type StopReason } from "./report";
import { emit } from "./record";

const { agentRuns, settings } = schema;
const KEY = "background";
type Mode = { on: boolean; since: string | null; start?: EnergyReading | null };

export async function getBackground(): Promise<Mode> {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
  return (row?.value as Mode) ?? { on: false, since: null };
}

async function setMode(mode: Mode) {
  await db.insert(settings).values({ key: KEY, value: mode }).onConflictDoUpdate({ target: settings.key, set: { value: mode } });
}

/** Prende el modo producción: las tareas guardadas pasan a la cola, en el orden en que se guardaron. */
export async function startBackground() {
  if ((await getBackground()).on) return 0;
  const energy = await getEnergy();
  if (backgroundShouldStop(energy)) return 0; // poca cuota: no arranca (el panel lo explica)
  const runs = await db.update(agentRuns).set({ status: "queued" }).where(eq(agentRuns.status, "scheduled")).returning({ id: agentRuns.id, agentId: agentRuns.agentId, createdAt: agentRuns.createdAt });
  if (runs.length === 0) return 0;
  await setMode({ on: true, since: new Date().toISOString(), start: energy });
  await emit("sistema", null, "background_on", { tasks: runs.length });
  for (const r of runs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) await enqueue({ runId: r.id });
  return runs.length;
}

/** Apaga el modo producción. Lo que está trabajando termina; lo guardado que no empezó vuelve a quedar guardado. */
export async function stopBackground(reason: StopReason) {
  const mode = await getBackground();
  if (!mode.on) return;
  await setMode({ on: false, since: null });
  // Solo las tareas del modo producción; si el worker ya tomó el trabajo, executeRun no hace nada (exige "queued").
  const back = await db
    .update(agentRuns)
    .set({ status: "scheduled" })
    .where(and(eq(agentRuns.status, "queued"), sql`${agentRuns.input}->>'background' = 'true'`))
    .returning({ id: agentRuns.id });
  const report = await backgroundReport(new Date(mode.since ?? Date.now()), reason, back.length, mode.start ?? null);
  await emit("sistema", null, "background_report", report);
  await sendText(reportText(report)).catch((e) => console.error("[telegram]", String(e)));
}

/** Después de cada tarea: si el modo producción está prendido y se quedó sin energía o sin trabajo, se apaga solo y avisa. */
export async function checkBackgroundDone() {
  if (!(await getBackground()).on) return;
  if (backgroundShouldStop(await getEnergy())) return stopBackground("energy");
  const [left] = await db.select({ n: sql<number>`count(*)::int` }).from(agentRuns).where(inArray(agentRuns.status, ["queued", "working"]));
  if (left.n === 0) await stopBackground("done");
}

// Cuánto de cada ventana gastó la sesión (solo si la ventana no se reinició en el medio): sirve para recomendar la reserva.
const spent = (a?: Window, b?: Window): [number, number] | null => (a && b && a.resetsAt === b.resetsAt ? [a.usedPct, b.usedPct] : null);

async function backgroundReport(since: Date, reason: StopReason, leftSaved: number, start: EnergyReading | null): Promise<Report> {
  const end = await getEnergy();
  const runs = await db.select({ status: agentRuns.status, agentId: agentRuns.agentId, taskType: agentRuns.taskType, error: agentRuns.error }).from(agentRuns).where(gte(agentRuns.startedAt, since));
  const [pending] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.approvals).where(eq(schema.approvals.status, "pending"));
  return {
    reason,
    done: runs.filter((r) => r.status === "done").length,
    failed: runs.filter((r) => r.status === "failed").length,
    waiting: pending.n,
    leftSaved,
    failures: runs.filter((r) => r.status === "failed").map((r) => `${r.agentId} · ${r.taskType}: ${(r.error ?? "").slice(0, 120)}`),
    minutes: Math.round((Date.now() - since.getTime()) / 60_000),
    quota: { fiveHour: spent(start?.fiveHour, end?.fiveHour), sevenDay: spent(start?.sevenDay, end?.sevenDay) },
  };
}
