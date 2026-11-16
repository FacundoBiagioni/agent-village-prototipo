import { and, asc, count, countDistinct, desc, eq, gte, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { connection } from "next/server";
import { agents } from "@/agents";
import { db, schema } from "@/db";
import { getBackground } from "@/runtime/background";
import { getEnergy } from "@/runtime/energy";
import { median } from "@/runtime/eta";
import { getQuotaLimits } from "@/runtime/supervisor";
import { AURA_AGENT, getEquipment, listInventory } from "@/runtime/skills";
import { auraSlotsFor, slotsFor } from "@/runtime/skills-rules";
import { claudeUsage, startOfDayAR } from "@/runtime/supervisor-rules";
import { attemptsOf, stageKey } from "@/runtime/routing";
import { PROMOTE, rungKey, savings, statsOf, verdict } from "@/brains/routing";
import { backgroundShouldStop, energyLevel } from "@/village/energy";
import type { Report } from "@/runtime/report";
import { ASCII_DEFAULT, cleanAscii, type AsciiConfig } from "@/village/office/ascii-config";
import { COATS } from "@/village/office/characters";
import { BACKGROUNDS } from "@/village/office/backgrounds";
import { HOUSE_THEMES } from "@/village/office/house-themes";
import { BASEMENT_VARIANTS, MAX_BASEMENTS, NAME_MAX, SHORT_MAX, type FloorNames } from "@/village/office/layout";
import { UI_THEMES } from "@/village/office/ui-themes";
import { levelFor, queueStartsIn, villageState, XP } from "@/village/state";

const { agentRuns, approvals } = schema;
export type Run = typeof agentRuns.$inferSelect;

/** Mediana de las últimas 20 ejecuciones terminadas de la misma tarea con el mismo cerebro (PLAN 9.4). */
async function medianMs(agentId: string, taskType: string, brain: Run["brain"]) {
  const past = await db
    .select({ d: agentRuns.durationMs })
    .from(agentRuns)
    .where(and(eq(agentRuns.agentId, agentId), eq(agentRuns.taskType, taskType), eq(agentRuns.brain, brain), eq(agentRuns.status, "done")))
    .orderBy(desc(agentRuns.finishedAt))
    .limit(20);
  return median(past.map((p) => p.d ?? 0));
}

/** Experiencia por agente, desde resultados reales (XP en village/state.ts). */
async function xpByAgent() {
  const xp: Record<string, number> = {};
  const add = (id: string, n: number) => (xp[id] = (xp[id] ?? 0) + n);
  const done = await db.select({ id: agentRuns.agentId, n: count() }).from(agentRuns).where(eq(agentRuns.status, "done")).groupBy(agentRuns.agentId);
  for (const r of done) add(r.id, r.n * XP.taskDone);
  const ok = await db.select({ id: approvals.agentId, n: count() }).from(approvals).where(eq(approvals.status, "approved")).groupBy(approvals.agentId);
  for (const r of ok) add(r.id, r.n * XP.approved);
  // La demo que salió publicada también es mérito del Diseñador.
  const [pub] = await db
    .select({ n: countDistinct(sql`${approvals.payload}->>'demoId'`) })
    .from(approvals)
    .where(and(eq(approvals.actionType, "publish_demo"), eq(approvals.status, "approved")));
  add("disenador", pub.n * XP.demoPublished);
  const [replied] = await db.select({ n: count() }).from(schema.messages).where(isNotNull(schema.messages.repliedAt));
  const [clients] = await db.select({ n: count() }).from(schema.clients);
  add("comunicador", replied.n * XP.replied + clients.n * XP.client);
  return xp;
}

export async function getAgentStates() {
  await connection();
  const now = Date.now();
  const xp = await xpByAgent();
  const outOfEnergy = energyLevel(await getEnergy(), now) === 0;
  const equipment = await getEquipment();
  return Promise.all(
    agents.map(async (agent) => {
      // Las guardadas para el modo producción no cuentan: todavía no son trabajo del agente.
      const [run] = await db.select().from(agentRuns).where(and(eq(agentRuns.agentId, agent.id), ne(agentRuns.status, "scheduled"))).orderBy(desc(agentRuns.createdAt)).limit(1);
      const med = run ? await medianMs(agent.id, run.taskType, run.brain) : null;
      const etaMs = run?.status === "working" && run.startedAt && med != null ? Math.max(0, med - (now - run.startedAt.getTime())) : null;
      // Última tarea que este agente le pasó a otro (input.from), para mostrarlo "llevándola".
      const [handoff] = await db
        .select({ at: agentRuns.createdAt, to: agentRuns.agentId })
        .from(agentRuns)
        .where(sql`${agentRuns.input}->>'from' = ${agent.id}`)
        .orderBy(desc(agentRuns.createdAt))
        .limit(1);
      const state = villageState({ run, now, medianMs: med, handedOffAt: handoff?.at, outOfEnergy });
      // Para el panel del agente en la oficina: últimas tareas y skills equipadas.
      const history = await db
        .select({ id: agentRuns.id, taskType: agentRuns.taskType, status: agentRuns.status, durationMs: agentRuns.durationMs, createdAt: agentRuns.createdAt, brain: agentRuns.brain, model: agentRuns.model })
        .from(agentRuns)
        .where(and(eq(agentRuns.agentId, agent.id), ne(agentRuns.status, "scheduled")))
        .orderBy(desc(agentRuns.createdAt))
        .limit(5);
      const skills = [...new Set(Object.values(agent.tasks).flatMap((t) => t.equippedSkills ?? []))];
      const tasks = Object.fromEntries(Object.entries(agent.tasks).map(([id, t]) => [id, t.label]));
      // Cerebro configurado de cada tarea (con sus etapas): lo que usa hoy, no lo que usó la última vez.
      const brains = Object.values(agent.tasks).map((t) => ({ task: t.label, brain: t.brain, model: t.model ?? null, stages: Object.values(t.stages ?? {}).map((s) => ({ brain: s.brain, model: s.model ?? null })) }));
      // ¿Alguna tarea usa IA? Si no, las skills equipadas no cambian nada (solo se pasan a los pedidos a la IA).
      const usesAI = Object.values(agent.tasks).some((t) => t.brain !== "code" || Object.values(t.stages ?? {}).some((s) => s.brain !== "code"));
      const lvl = levelFor(xp[agent.id] ?? 0).level;
      return {
        agent: { id: agent.id, name: agent.name, role: agent.role, world: agent.world, skills, tasks, usesAI, brains },
        equipped: equipment[agent.id] ?? [],
        slots: agent.id === AURA_AGENT ? auraSlotsFor(lvl) : slotsFor(lvl),
        run,
        etaMs,
        state,
        movingTo: state === "moving" ? handoff?.to ?? null : null,
        history,
        ...levelFor(xp[agent.id] ?? 0),
        xp: xp[agent.id] ?? 0,
      };
    }),
  );
}

/** Tareas en cola con "empieza en ~X" (el worker hace una por vez, en orden de llegada). */
export async function getQueue() {
  await connection();
  const now = Date.now();
  const queued = await db.select().from(agentRuns).where(eq(agentRuns.status, "queued")).orderBy(asc(agentRuns.createdAt));
  if (queued.length === 0) return [];
  const working = await db.select().from(agentRuns).where(eq(agentRuns.status, "working"));
  let remaining = 0;
  for (const w of working) {
    const m = await medianMs(w.agentId, w.taskType, w.brain);
    remaining += m == null || !w.startedAt ? 0 : Math.max(0, m - (now - w.startedAt.getTime()));
  }
  const medians = await Promise.all(queued.map((q) => medianMs(q.agentId, q.taskType, q.brain)));
  const startsIn = queueStartsIn(remaining, medians);
  return queued.map((q, i) => ({ run: q, startsInMs: startsIn[i] }));
}

export async function getPendingApprovals() {
  await connection();
  return db.select().from(approvals).where(eq(approvals.status, "pending")).orderBy(desc(approvals.createdAt));
}

export async function getRecentRuns() {
  await connection();
  return db.select().from(agentRuns).orderBy(desc(agentRuns.createdAt)).limit(12);
}

/** Modo producción: si está prendido, cuántas tareas guardadas hay y el último informe. */
export async function getBackgroundPanel() {
  await connection();
  const mode = await getBackground();
  const scheduled = await db.select({ agentId: agentRuns.agentId, taskType: agentRuns.taskType, brain: agentRuns.brain }).from(agentRuns).where(eq(agentRuns.status, "scheduled"));
  // Cuánto tardaría el lote guardado (PLAN 9.4): suma de las medianas; null si alguna tarea no tiene historial.
  const medians = await Promise.all(scheduled.map((r) => medianMs(r.agentId, r.taskType, r.brain)));
  const batchMs = medians.some((m) => m == null) ? null : medians.reduce<number>((a, m) => a + (m ?? 0), 0);
  const [last] = await db
    .select({ payload: schema.agentEvents.payload, at: schema.agentEvents.createdAt })
    .from(schema.agentEvents)
    .where(eq(schema.agentEvents.type, "background_report"))
    .orderBy(desc(schema.agentEvents.createdAt))
    .limit(1);
  const energy = await getEnergy();
  return { ...mode, saved: scheduled.length, batchMs, lowEnergy: backgroundShouldStop(energy), lastReport: last ? { report: last.payload as Report, at: last.at } : null };
}

/** Energía del pueblo: la última lectura de la cuota de Claude. */
export async function getEnergyPanel() {
  await connection();
  const r = await getEnergy();
  return { reading: r, level: energyLevel(r) };
}

/** Cómo se ve la casa y cómo está armada: aspecto, sótanos que agregó el usuario, dónde se sienta cada agente y el modo ASCII. */
export type OfficeConfig = { species: string; light: "auto" | "day" | "night"; pixel: boolean; basements: string[]; desks: Record<string, string>; ascii: AsciiConfig; names: FloorNames; coats: Record<string, string>; houseTheme: string; uiTheme: string; background: string };
export const OFFICE_DEFAULT: OfficeConfig = { species: "gato", light: "auto", pixel: true, basements: [], desks: {}, ascii: ASCII_DEFAULT, names: { house: "", basements: [], houseShort: "", basementShorts: [] }, coats: {}, houseTheme: "campo", uiTheme: "juego", background: "casa" };
const cleanName = (v: unknown, max = NAME_MAX) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export async function getOfficeConfig(): Promise<OfficeConfig> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "office"));
  const v = (row?.value ?? {}) as Partial<OfficeConfig>;
  const basements = Array.isArray(v.basements) ? v.basements.filter((b) => BASEMENT_VARIANTS.some((x) => x.id === b)).slice(0, MAX_BASEMENTS) : [];
  const coats = v.coats && typeof v.coats === "object" ? Object.fromEntries(Object.entries(v.coats).filter(([, c]) => COATS.some((x) => x.id === c))) : {};
  return {
    species: typeof v.species === "string" ? v.species : OFFICE_DEFAULT.species,
    light: v.light === "day" || v.light === "night" ? v.light : "auto",
    pixel: typeof v.pixel === "boolean" ? v.pixel : true,
    basements,
    desks: v.desks && typeof v.desks === "object" ? v.desks : {},
    ascii: cleanAscii(v.ascii),
    names: {
      house: cleanName(v.names?.house),
      basements: basements.map((_, i) => cleanName(v.names?.basements?.[i])),
      houseShort: cleanName(v.names?.houseShort, SHORT_MAX),
      basementShorts: basements.map((_, i) => cleanName(v.names?.basementShorts?.[i], SHORT_MAX)),
    },
    coats,
    houseTheme: HOUSE_THEMES.some((t) => t.id === v.houseTheme) ? v.houseTheme! : OFFICE_DEFAULT.houseTheme,
    uiTheme: UI_THEMES.some((t) => t.id === v.uiTheme) ? v.uiTheme! : OFFICE_DEFAULT.uiTheme,
    background: BACKGROUNDS.some((b) => b.id === v.background) ? v.background! : OFFICE_DEFAULT.background,
  };
}

/** Panel del Encargado: consumo de Claude por agente y tarea (hoy y 7 días), ahorro, avisos y límites diarios. */
export async function getSupervisorPanel() {
  await connection();
  const now = Date.now();
  const week = new Date(now - 7 * 86_400_000);
  const today = startOfDayAR(new Date(now));
  const runs = await db
    .select({ agentId: agentRuns.agentId, taskType: agentRuns.taskType, usage: agentRuns.usage, startedAt: agentRuns.startedAt })
    .from(agentRuns)
    .where(gte(agentRuns.startedAt, week));
  const limits = await getQuotaLimits();
  // Solo las tareas que usan Claude (las de código o modelo local no gastan cuota).
  const usesClaude = (t: { brain: string; fallback?: string }) => t.brain === "claude" || t.fallback === "claude";
  const claudeTasks = agents.flatMap((a) =>
    Object.entries(a.tasks)
      .filter(([, t]) => usesClaude(t) || Object.values(t.stages ?? {}).some(usesClaude))
      .map(([id, t]) => ({ key: `${a.id}/${id}`, agent: a.name, task: t.label })),
  );
  const total = (list: typeof runs) =>
    list.reduce(
      (acc, r) => {
        const u = claudeUsage(r.usage);
        return { runs: acc.runs + (u.calls ? 1 : 0), quota: acc.quota + u.quotaPct };
      },
      { runs: 0, quota: 0 },
    );
  const rows = claudeTasks.map((ct) => {
    const mine = runs.filter((r) => `${r.agentId}/${r.taskType}` === ct.key);
    const t = total(mine.filter((r) => r.startedAt && r.startedAt >= today));
    const w = total(mine);
    return { ...ct, limit: limits[ct.key] ?? null, todayRuns: t.runs, todayQuota: Math.round(t.quota * 10) / 10, weekRuns: w.runs, weekQuota: Math.round(w.quota * 10) / 10 };
  });
  const events = await db
    .select({ type: schema.agentEvents.type, payload: schema.agentEvents.payload, at: schema.agentEvents.createdAt })
    .from(schema.agentEvents)
    .where(and(inArray(schema.agentEvents.type, ["supervisor_blocked", "supervisor_retry", "supervisor_alert"]), gte(schema.agentEvents.createdAt, week)))
    .orderBy(desc(schema.agentEvents.createdAt));
  const describe = (p: { text?: string; reason?: string; agentId?: string }) => p.text ?? `${p.agentId}: ${p.reason}`;
  return {
    rows,
    blocked: events.filter((e) => e.type === "supervisor_blocked").length,
    retried: events.filter((e) => e.type === "supervisor_retry").length,
    alerts: events
      .filter((e) => e.type !== "supervisor_retry")
      .slice(0, 5)
      .map((e) => ({ at: e.at, text: describe(e.payload as { text?: string; reason?: string; agentId?: string }) })),
  };
}

const MODEL_NAMES: Record<string, string> = { "claude-haiku-5-5": "Haiku", "claude-sonnet-5-5": "Sonnet", "claude-opus-5-5": "Opus" };
const modelName = (rung: string) => {
  const [brain, model] = rung.split(":");
  return brain === "local" ? `modelo local (${model})` : (MODEL_NAMES[model] ?? model);
};

/** Ruteo de cerebros (Fase 6): por cada etapa con escalones baratos, cómo le va a cada uno y cuánto se ahorró. */
export async function getRoutingPanel() {
  await connection();
  const stages = agents.flatMap((a) =>
    Object.entries(a.tasks).flatMap(([taskId, t]) =>
      Object.entries(t.stages ?? { "-": t })
        .filter(([, c]) => c.cheaper?.length)
        .map(([stage, c]) => ({ key: stageKey(a.id, taskId, stage === "-" ? undefined : stage), agent: a.name, task: t.label, stage, base: rungKey(c), cheaper: c.cheaper!.map(rungKey) })),
    ),
  );
  return Promise.all(
    stages.map(async (s) => {
      const attempts = await attemptsOf(s.key, 1000);
      const stats = statsOf(attempts);
      const rungs = [...s.cheaper, s.base].map((r) => {
        const st = stats.get(r);
        const v = r === s.base ? "base" : verdict(st);
        return { name: modelName(r), tries: st?.tries ?? 0, ok: st?.ok ?? 0, verdict: v };
      });
      return { ...s, rungs, saved: savings(attempts, s.base), total: attempts.filter((a) => a.first).length };
    }),
  );
}
export const ROUTING_RULE = PROMOTE;

/** Inventario de skills revisadas (para equipar desde la oficina). */
export async function getSkillInventory() {
  await connection();
  return listInventory();
}
