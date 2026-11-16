// Armar, aprobar y rechazar el mensaje de WhatsApp de un negocio (código común, sin IA). Lo usan el Comunicador
// (mensaje solo) y el Analista (publicar la demo y armar el mensaje en una sola aprobación). Nunca envía nada.
import { and, desc, eq, gt, ne, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { PAGES_PROJECT } from "@/demos/publish";
import { checkMessage, LINK_MARK, whatsappNumber } from "./content";
import { draftMessage } from "./template";

const SELLER = process.env.SELLER_NAME ?? "Facundo"; // shortcut: nombre fijo por variable de entorno; pasarlo a `settings` con la Fase 3

/** Lista de no contactar: por etapa del lead o por teléfono (Ley 25.326, PLAN 6.3). */
export async function blocked(lead: { id: string; stage: string; phone: string | null }) {
  if (lead.stage === "do_not_contact") return true;
  const digits = (lead.phone ?? "").replace(/\D/g, "");
  const [hit] = await db
    .select({ id: schema.doNotContact.id })
    .from(schema.doNotContact)
    .where(digits ? or(eq(schema.doNotContact.leadId, lead.id), eq(schema.doNotContact.phone, digits)) : eq(schema.doNotContact.leadId, lead.id))
    .limit(1);
  return !!hit;
}

/** Arma el mensaje (queda "esperando aprobación") con el link público de su demo vigente (la indicada o la más reciente). */
export async function prepareMessage(leadId: string, demoId?: string) {
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId));
  if (!lead) throw new Error("Negocio inexistente");
  if (await blocked(lead)) throw new Error("El negocio está en la lista de no contactar");
  const number = whatsappNumber(lead.phone);
  if (!number) throw new Error("No tiene celular para WhatsApp (teléfono fijo o sin teléfono): conviene llamar o visitarlo");
  const [pending] = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .where(and(eq(schema.messages.leadId, lead.id), ne(schema.messages.status, "rejected"), ne(schema.messages.status, "sent")))
    .limit(1);
  if (pending) throw new Error("Ya hay un mensaje para este negocio esperando aprobación o envío");
  const [demo] = await db
    .select()
    .from(schema.demos)
    .where(and(eq(schema.demos.leadId, lead.id), ne(schema.demos.status, "removed"), gt(schema.demos.expiresAt, new Date()), demoId ? eq(schema.demos.id, demoId) : undefined))
    .orderBy(desc(schema.demos.createdAt))
    .limit(1);
  if (!demo) throw new Error("Primero hay que preparar una demo para este negocio");

  const text = draftMessage({ id: lead.id, name: lead.name, niche: lead.niche, webStatus: lead.webStatus, seller: SELLER });
  // Las mismas reglas de siempre (link una vez, sin precios ni teléfonos, voseo): las plantillas ya las cumplen por test.
  const problems = checkMessage(text);
  if (problems.length) throw new Error(`Mensaje rechazado por las reglas: ${problems.join("; ")}`);
  const finalText = text.replace(LINK_MARK, `https://${PAGES_PROJECT}.pages.dev/demo/${demo.slug}`);
  const [msg] = await db.insert(schema.messages).values({ leadId: lead.id, demoId: demo.id, phone: number, text: finalText }).returning({ id: schema.messages.id });
  return { messageId: msg.id, negocio: lead.name, whatsapp: `+${number}`, mensaje: finalText, demo };
}

/** No envía: deja el mensaje aprobado y la interfaz muestra "Abrir WhatsApp" para que lo mandes vos. */
export async function approveMessage(messageId: string) {
  const [msg] = await db.select().from(schema.messages).where(eq(schema.messages.id, messageId));
  if (!msg || msg.status !== "pending_approval") throw new Error("El mensaje no está esperando aprobación");
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, msg.leadId));
  if (await blocked(lead)) {
    await db.update(schema.messages).set({ status: "rejected" }).where(eq(schema.messages.id, msg.id));
    throw new Error("El negocio pasó a no contactar antes de aprobar: mensaje anulado");
  }
  await db.update(schema.messages).set({ status: "approved", approvedAt: new Date() }).where(eq(schema.messages.id, msg.id));
}

export async function rejectMessage(messageId: string) {
  await db.update(schema.messages).set({ status: "rejected" }).where(and(eq(schema.messages.id, messageId), eq(schema.messages.status, "pending_approval")));
}
