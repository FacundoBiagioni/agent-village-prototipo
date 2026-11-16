import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { startRun } from "@/runtime/start";
import { addDomain, buildPausedSite, buildSite, deployToVercel, projectName } from "@/sites/site";
import { cobrador, stillPending } from "./cobrador";
import type { AgentConfig } from "./types";

async function clientRow(clientId: unknown) {
  const [row] = await db
    .select({ client: schema.clients, lead: schema.leads })
    .from(schema.clients)
    .innerJoin(schema.leads, eq(schema.leads.id, schema.clients.leadId))
    .where(eq(schema.clients.id, String(clientId)));
  if (!row) throw new Error("Cliente inexistente");
  return row;
}

/** La demo del cliente que se convierte en su sitio: la más nueva que no se sacó. */
async function clientDemo(leadId: string) {
  const [demo] = await db
    .select()
    .from(schema.demos)
    .where(and(eq(schema.demos.leadId, leadId), ne(schema.demos.status, "removed")))
    .orderBy(desc(schema.demos.updatedAt))
    .limit(1);
  if (!demo) throw new Error("El cliente no tiene una demo para convertir en su sitio");
  return demo;
}

// PLAN 6.5: código común, sin IA. Publica y pausa sitios de clientes en Vercel, siempre con aprobación.
export const hosting: AgentConfig = {
  id: "hosting",
  name: "Hosting",
  role: "Convierte la demo del cliente en su sitio, lo publica en Vercel con su dominio y lo pausa o reactiva según los pagos. Todo con tu aprobación.",
  tools: [],
  world: { desk: 6, skin: "hosting" },
  tasks: {
    publicar_sitio: {
      label: "Publicar o reactivar el sitio de un cliente (requiere aprobación)",
      startsFrom: "Ventas",
      brain: "code",
      steps: ["Armar el sitio", "Esperar aprobación", "Subir a Vercel"],
      async run(ctx) {
        await ctx.step("Armar el sitio");
        const { client, lead } = await clientRow(ctx.input.clientId);
        const demo = await clientDemo(lead.id);
        const project = client.siteProject ?? projectName(lead.name, demo.slug);
        // Se arma ahora (sin subir nada) para que el usuario lo pueda revisar antes de aprobar.
        const built = await buildSite(demo, project);
        await ctx.step("Esperar aprobación");
        return { clientId: client.id, negocio: lead.name, proyecto: project, carpeta: built.dir, paginas: built.pages, dominio: client.domain, reactivar: client.siteStatus === "paused" };
      },
      external: {
        actionType: "publish_site",
        async execute(payload) {
          const p = payload as { clientId: string; proyecto: string; carpeta: string; dominio: string | null };
          const deployed = await deployToVercel(p.carpeta);
          if (p.dominio) await addDomain(p.dominio, p.proyecto);
          const url = p.dominio ? `https://${p.dominio}` : deployed.url;
          const [c] = await db.update(schema.clients).set({ siteProject: p.proyecto, siteUrl: url, siteStatus: "online" }).where(eq(schema.clients.id, p.clientId)).returning();
          await db.update(schema.leads).set({ stage: "hosted", updatedAt: new Date() }).where(eq(schema.leads.id, c.leadId));
          return { url, vercelUrl: deployed.url };
        },
      },
    },
    pausar_sitio: {
      label: "Pausar el sitio de un cliente por falta de pago (requiere aprobación)",
      startsFrom: "Ventas (lo pide solo a los 30 días de una cuota impaga)",
      brain: "code",
      steps: ["Preparar la pausa", "Esperar aprobación", "Subir la página de mantenimiento"],
      async run(ctx) {
        await ctx.step("Preparar la pausa");
        const { client, lead } = await clientRow(ctx.input.clientId);
        if (client.siteStatus !== "online" || !client.siteProject) throw new Error("El sitio no está en línea: no hay nada que pausar");
        await ctx.step("Esperar aprobación");
        return { clientId: client.id, paymentId: ctx.input.paymentId ?? null, negocio: lead.name, proyecto: client.siteProject, motivo: String(ctx.input.reason ?? "cuota impaga") };
      },
      external: {
        actionType: "pause_site",
        async execute(payload) {
          const p = payload as { clientId: string; paymentId: string | null; negocio: string; proyecto: string };
          if (p.paymentId && !(await stillPending(p.paymentId))) throw new Error("Esa cuota ya figura cobrada: el sitio no se pausa");
          const { dir } = await buildPausedSite(p.negocio, p.proyecto);
          await deployToVercel(dir);
          await db.update(schema.clients).set({ siteStatus: "paused" }).where(eq(schema.clients.id, p.clientId));
          // El aviso al cliente sale recién ahora, y también pasa por la bandeja.
          if (p.paymentId) await startRun("cobrador", "recordar_cobro", cobrador.tasks.recordar_cobro, { clientId: p.clientId, paymentId: p.paymentId, stage: "pausa" });
          return { paused: true };
        },
      },
    },
  },
};
