import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DemoContent } from "./content";
import { galleryPages } from "./gallery-store";

// Igual que el sandbox del marco: sin scripts ni acceso a la app (el HTML ya pasó checkOpusPage o checkTemplate).
export const SANDBOX_HEADERS = { "content-type": "text/html; charset=utf-8", "content-security-policy": "sandbox allow-popups allow-top-navigation-by-user-activation", "x-robots-tag": "noindex, nofollow" };

/** HTML propio de una demo para verla en local dentro del marco de /demo/[slug]: la versión de Opus o una plantilla de la galería.
 *  Con srcDoc, los links "#seccion" recargaban la demo dentro del marco y quedaba en blanco. */
export async function demoHtml(slug: string, page: string) {
  if (!/^[a-z0-9]{10}$/.test(slug) || !/^[a-z]+$/.test(page)) return null;
  const [demo] = await db.select().from(schema.demos).where(eq(schema.demos.slug, slug));
  const c = demo?.content as DemoContent | undefined;
  if (!demo || !c || demo.status === "removed" || demo.status === "expired" || demo.expiresAt < new Date()) return null;
  if (c.design === "galeria") return (await galleryPages(c, demo.expiresAt, `/demo/${slug}/vista`))?.[page] ?? null;
  return page === "inicio" && c.opus ? c.opus.html : null;
}

export async function demoHtmlResponse(slug: string, page: string) {
  const html = await demoHtml(slug, page);
  return html ? new Response(html, { headers: SANDBOX_HEADERS }) : new Response("No existe", { status: 404 });
}
