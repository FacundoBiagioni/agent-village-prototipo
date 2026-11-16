import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** El usuario confirma que mandó el mensaje desde su celular: el negocio pasa a "contactado". Lo usan la web y Telegram. */
export async function markMessageSent(id: string) {
  const [msg] = await db
    .update(schema.messages)
    .set({ status: "sent", sentAt: new Date() })
    .where(and(eq(schema.messages.id, id), eq(schema.messages.status, "approved")))
    .returning();
  if (!msg) throw new Error("El mensaje no está aprobado o ya figura como enviado");
  // Los recordatorios de cobro (canal "cobro") son a clientes: no cambian la etapa de venta.
  if (msg.channel === "whatsapp") await db.update(schema.leads).set({ stage: "contacted", updatedAt: new Date() }).where(eq(schema.leads.id, msg.leadId));
  return msg;
}
