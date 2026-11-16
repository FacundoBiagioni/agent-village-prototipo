import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { displayPhone } from "@/demos/content";
import { googleMapsUrl } from "@/leads/search";
import { normalizePhone } from "@/leads/classify";
import { planRoute, stageAfterVisit, todayAR, type Point, type VisitInput } from "./plan";

const RECENT_DAYS = 7; // no vuelve a la ruta lo visitado hace menos de una semana, salvo que haya que volver hoy

/** Paradas del día: negocios con demo vigente que todavía no dijeron que no, ordenados por cercanía. */
export async function routeForToday(start: Point, max: number, today = new Date()) {
  const rows = await db
    .select({ lead: schema.leads, demo: { id: schema.demos.id, slug: schema.demos.slug } })
    .from(schema.leads)
    .innerJoin(schema.demos, eq(schema.demos.leadId, schema.leads.id))
    .where(and(inArray(schema.leads.stage, ["demo_created", "contacted", "replied"]), ne(schema.demos.status, "removed"), gt(schema.demos.expiresAt, today)))
    .orderBy(desc(schema.demos.createdAt));
  const byLead = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!byLead.has(r.lead.id)) byLead.set(r.lead.id, r); // la demo más nueva de cada negocio

  const leadIds = [...byLead.keys()];
  const past = leadIds.length ? await db.select().from(schema.visits).where(inArray(schema.visits.leadId, leadIds)).orderBy(desc(schema.visits.visitedAt)) : [];
  const last = new Map<string, (typeof past)[number]>();
  for (const v of past) if (!last.has(v.leadId)) last.set(v.leadId, v);
  const todayStr = todayAR(today);
  const due = (leadId: string) => {
    const v = last.get(leadId);
    if (!v) return true;
    if (v.comeBackOn) return v.comeBackOn <= todayStr;
    return today.getTime() - v.visitedAt.getTime() > RECENT_DAYS * 86_400_000;
  };

  const candidates = [...byLead.values()].filter((r) => due(r.lead.id)).map((r) => ({ ...r, lat: r.lead.lat, lng: r.lead.lng }));
  return planRoute(start, candidates, max).map(({ lead, demo }) => ({
    leadId: lead.id,
    demoId: demo.id,
    name: lead.name,
    address: lead.address,
    phone: lead.phone ? displayPhone(lead.phone) : null,
    lat: lead.lat,
    lng: lead.lng,
    mapsUrl: googleMapsUrl(lead),
    demoUrl: `/demo/${demo.slug}`,
    lastVisit: last.get(lead.id) ? { result: last.get(lead.id)!.result, note: last.get(lead.id)!.note, on: last.get(lead.id)!.visitedAt.toISOString() } : null,
  }));
}

/** Guarda las visitas que suben del celular. Repetir la subida no duplica nada (clientId único). */
export async function saveVisits(visits: VisitInput[]) {
  let saved = 0;
  for (const v of visits) {
    await db.transaction(async (tx) => {
      const [lead] = await tx.select().from(schema.leads).where(eq(schema.leads.id, v.leadId));
      if (!lead) return; // negocio borrado mientras tanto
      const inserted = await tx
        .insert(schema.visits)
        .values({ ...v, visitedAt: new Date(v.visitedAt) })
        .onConflictDoNothing({ target: schema.visits.clientId })
        .returning({ id: schema.visits.id });
      if (!inserted.length) return; // ya se había subido
      saved++;
      const stage = stageAfterVisit(lead.stage, v.result, v.doNotContact) as typeof lead.stage;
      if (v.doNotContact && lead.stage !== "do_not_contact") {
        await tx.insert(schema.doNotContact).values({ leadId: lead.id, name: lead.name, phone: normalizePhone(lead.phone), reason: "Visita: no le interesa" });
      }
      if (stage !== lead.stage) {
        await tx.update(schema.leads).set({ stage, lostReason: stage === "lost" ? "No le interesa" : lead.lostReason, updatedAt: new Date() }).where(eq(schema.leads.id, lead.id));
      }
    });
  }
  return { received: visits.length, saved };
}
