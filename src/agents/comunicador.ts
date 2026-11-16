import { approveMessage, prepareMessage, rejectMessage } from "@/messages/prepare";
import type { AgentConfig } from "./types";

export const comunicador: AgentConfig = {
  id: "comunicador",
  name: "Comunicador",
  role: "Redacta un mensaje de WhatsApp para un negocio con el link de su demo. Nunca envía nada: el usuario aprueba y lo manda desde su celular.",
  tools: [], // no ejecuta comandos ni envía mensajes (CLAUDE.md, Seguridad)
  world: { desk: 2, skin: "comunicador" },
  tasks: {
    redactar_mensaje: {
      label: "Redactar mensaje de WhatsApp (requiere aprobación)",
      startsFrom: "Demos",
      // Plantillas con código común (2026-11-05): el mensaje es siempre la misma estructura con datos que ya están en la base.
      // Sin IA no gasta cuota, no inventa y no falla. Las plantillas siguen la skill tono-mensajes-venta (src/messages/template.ts).
      brain: "code",
      steps: ["Revisar negocio", "Armar mensaje", "Esperar aprobación"],
      async run(ctx) {
        await ctx.step("Revisar negocio");
        await ctx.step("Armar mensaje");
        const m = await prepareMessage(String(ctx.input.leadId));
        await ctx.step("Esperar aprobación");
        return {
          messageId: m.messageId,
          negocio: m.negocio,
          whatsapp: m.whatsapp,
          mensaje: m.mensaje,
          aviso: m.demo.status === "published" ? null : "La demo todavía NO está publicada: el link no va a abrir hasta que la publiques (o usá \"Publicar y preparar mensaje\" en Demos).",
        };
      },
      external: {
        actionType: "whatsapp_message",
        async execute(payload) {
          await approveMessage((payload as { messageId: string }).messageId);
          return { listoParaEnviar: true };
        },
        async onReject(payload) {
          await rejectMessage((payload as { messageId: string }).messageId);
        },
      },
    },
  },
};
