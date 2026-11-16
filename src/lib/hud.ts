// Datos del HUD de la casa: lo pendiente de cada sección (contadores y centro de avisos).
import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import type { Pending } from "@/village/notices";
import { todayAR } from "@/visits/plan";

const count = sql<number>`count(*)::int`;

/** Lo que está pendiente en todo el panel. `agents`: los estados ya calculados (para no pedirlos dos veces). */
export async function getPending(agents: { id: string; name: string; state: string }[], energy: number | null): Promise<Pending> {
  await connection();
  const now = new Date();
  const today = todayAR(now);
  const startOfToday = new Date(`${today}T00:00:00-03:00`);
  const [[approvals], [templates], [messages], [payments], visits, [report]] = await Promise.all([
    db.select({ n: count }).from(schema.approvals).where(eq(schema.approvals.status, "pending")),
    db.select({ n: count }).from(schema.templates).where(eq(schema.templates.status, "pending")),
    db.select({ n: count }).from(schema.messages).where(eq(schema.messages.status, "approved")),
    // Vencido: pendiente y con fecha anterior a hoy (igual que isOverdue en sales/offers.ts).
    db.select({ n: count }).from(schema.payments).where(and(eq(schema.payments.status, "pending"), isNotNull(schema.payments.dueDate), lt(schema.payments.dueDate, startOfToday))),
    // Para volver: la última visita de cada negocio, si fue "volver otro día" y el negocio sigue abierto (igual que la pantalla Visitas).
    db
      .selectDistinctOn([schema.visits.leadId], { result: schema.visits.result, comeBackOn: schema.visits.comeBackOn, stage: schema.leads.stage })
      .from(schema.visits)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.visits.leadId))
      .orderBy(schema.visits.leadId, desc(schema.visits.visitedAt)),
    db.select({ n: count }).from(schema.agentEvents).where(and(eq(schema.agentEvents.type, "background_report"), gte(schema.agentEvents.createdAt, new Date(now.getTime() - 86_400_000)))),
  ]);
  const comeBack = visits.filter((v) => v.result === "come_back" && v.comeBackOn && !["lost", "do_not_contact", "closed", "paying", "hosted"].includes(v.stage));
  return {
    approvals: approvals.n,
    templatesToReview: templates.n,
    messagesToSend: messages.n,
    visitsToday: comeBack.filter((v) => v.comeBackOn === today).length,
    visitsOverdue: comeBack.filter((v) => v.comeBackOn! < today).length,
    paymentsOverdue: payments.n,
    blocked: agents.filter((a) => a.state === "blocked").map(({ id, name }) => ({ id, name })),
    waiting: agents.filter((a) => a.state === "waiting_approval").map(({ id, name }) => ({ id, name })),
    freshReport: report.n > 0,
    energy,
  };
}

/** Buscador del HUD: negocios por nombre (los que ya se trabajaron primero). */
export async function findLeads(q: string) {
  const text = q.trim().slice(0, 60);
  if (text.length < 2) return [];
  return db
    .select({ id: schema.leads.id, name: schema.leads.name, niche: schema.leads.niche, address: schema.leads.address, stage: schema.leads.stage })
    .from(schema.leads)
    .where(sql`${schema.leads.name} ilike ${"%" + text.replace(/[%_\\]/g, "\\$&") + "%"}`)
    .orderBy(sql`(${schema.leads.stage} = 'found')`, schema.leads.name)
    .limit(8);
}
