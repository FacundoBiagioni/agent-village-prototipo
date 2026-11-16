import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { isSocialUrl } from "./classify";
import { checkWebsite } from "./webcheck";

const { leads } = schema;
const AT_ONCE = 6; // webs revisadas a la vez: cada una tarda hasta 15 s si no responde

/** Revisa las webs propias pendientes (portada, sin IA) y las marca como moderna, anticuada o caída.
 *  La corre el worker todos los días y después de cada importación de Overture (2026-11-10: antes no la llamaba nadie). */
export async function checkLeadWebs(limit: number) {
  const pending = await db
    .select({ id: leads.id, name: leads.name, websites: leads.websites })
    .from(leads)
    .where(and(eq(leads.webStatus, "unchecked"), isNotNull(leads.niche)))
    .limit(limit);
  const results: { name: string; url: string; status: string; score: number }[] = [];
  let socialOnly = 0;
  for (let i = 0; i < pending.length; i += AT_ONCE) {
    await Promise.all(
      pending.slice(i, i + AT_ONCE).map(async (lead) => {
        const url = lead.websites.find((w) => !isSocialUrl(w));
        if (!url) {
          // Solo redes o plataformas de turnos (reglas sumadas después de importar).
          socialOnly++;
          await db.update(leads).set({ webStatus: "social_only", updatedAt: new Date() }).where(eq(leads.id, lead.id));
          return;
        }
        const r = await checkWebsite(url);
        await db
          .update(leads)
          .set({ webStatus: r.status, webScore: r.score, webSignals: r.signals, webCheckedAt: new Date(), updatedAt: new Date() })
          .where(eq(leads.id, lead.id));
        results.push({ name: lead.name, url, status: r.status, score: r.score });
      }),
    );
  }
  const count = (s: string) => results.filter((r) => r.status === s).length;
  return { checked: results.length, outdated: count("outdated"), down: count("down"), ok: count("ok"), socialOnly };
}
