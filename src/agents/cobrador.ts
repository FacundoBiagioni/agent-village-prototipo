import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { whatsappNumber } from "@/messages/content";
import { approveMessage, rejectMessage } from "@/messages/prepare";
import { reminderText, type Stage } from "@/sales/billing";
import type { AgentConfig } from "./types";

const STAGES: Stage[] = ["antes", "vencido", "aviso_final", "pausa", "dominio"];

/** ¿El pago sigue sin cobrar? Se revisa al aprobar: entre que se preparó la acción y tu clic pudo haberse pagado. */
export async function stillPending(paymentId: string) {
  const [p] = await db.select({ status: schema.payments.status }).from(schema.payments).where(eq(schema.payments.id, paymentId));
  return p?.status === "pending";
}

/** Datos para cobrar: van en .env (no son secretos, pero son personales y no van en el código). */
export function payInfo() {
  const alias = process.env.PAY_ALIAS?.trim();
  const holder = process.env.PAY_HOLDER?.trim();
  if (!alias || !holder) throw new Error("Faltan PAY_ALIAS y PAY_HOLDER en .env (tu alias y el nombre del titular)");
  return { alias, holder, seller: process.env.SELLER_NAME ?? "Facundo" };
}

// PLAN 6.4: código común, sin IA. Nunca mueve dinero ni manda nada: arma el recordatorio y el usuario lo aprueba y lo envía.
export const cobrador: AgentConfig = {
  id: "cobrador",
  name: "Cobrador",
  role: "Sigue los cobros: prepara los recordatorios de pago y de renovación del dominio para que los apruebes y los mandes vos. No cobra ni envía nada.",
  tools: [],
  world: { desk: 4, skin: "cobrador" },
  tasks: {
    recordar_cobro: {
      label: "Recordatorio de pago (requiere aprobación)",
      startsFrom: "Ventas (lo pide solo cada día)",
      brain: "code",
      steps: ["Revisar cobro", "Armar mensaje", "Esperar aprobación"],
      async run(ctx) {
        await ctx.step("Revisar cobro");
        const stage = String(ctx.input.stage) as Stage;
        if (!STAGES.includes(stage)) throw new Error("Etapa inválida");
        const [row] = await db
          .select({ client: schema.clients, lead: schema.leads })
          .from(schema.clients)
          .innerJoin(schema.leads, eq(schema.leads.id, schema.clients.leadId))
          .where(eq(schema.clients.id, String(ctx.input.clientId)));
        if (!row) throw new Error("Cliente inexistente");
        const [payment] = ctx.input.paymentId ? await db.select().from(schema.payments).where(eq(schema.payments.id, String(ctx.input.paymentId))) : [];
        if (stage !== "dominio" && payment?.status !== "pending") throw new Error("El pago ya no está pendiente: no hace falta recordarlo");
        const phone = whatsappNumber(row.lead.phone);
        if (!phone) throw new Error("El cliente no tiene un celular cargado (+54 9...): avisale por otro medio");

        await ctx.step("Armar mensaje");
        const text = reminderText(stage, { concept: payment?.concept ?? "", amountUsd: payment?.amountUsd ?? 0, dueDate: payment?.dueDate ?? null, domain: row.client.domain, domainRenewsAt: row.client.domainRenewsAt }, payInfo());
        // Canal "cobro": el mismo circuito de WhatsApp (Abrir WhatsApp, Ya lo envié), pero no cuenta como contacto de venta.
        const [msg] = await db.insert(schema.messages).values({ leadId: row.lead.id, runId: null, channel: "cobro", phone, text }).returning();
        await ctx.step("Esperar aprobación");
        return { messageId: msg.id, paymentId: payment?.id ?? null, negocio: row.lead.name, whatsapp: `+${phone}`, mensaje: text };
      },
      external: {
        actionType: "whatsapp_message",
        async execute(payload) {
          const p = payload as { messageId: string; paymentId?: string | null };
          // Si lo cobraste mientras esperaba en la bandeja, el recordatorio ya no corresponde.
          if (p.paymentId && !(await stillPending(p.paymentId))) {
            await rejectMessage(p.messageId);
            throw new Error("Ese pago ya figura cobrado: el recordatorio se anuló");
          }
          await approveMessage(p.messageId);
          return { listoParaEnviar: true };
        },
        async onReject(payload) {
          await rejectMessage((payload as { messageId: string }).messageId);
        },
      },
    },
  },
};
