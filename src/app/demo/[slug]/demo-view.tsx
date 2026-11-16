import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { connection } from "next/server";
import { verifySiteToken } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { DemoContent } from "@/demos/content";
import { directionOf } from "@/demos/directions";
import { EditorialTemplate } from "@/demos/templates/editorial";
import { GroteskTemplate } from "@/demos/templates/grotesk";
import { PhotoTemplate } from "@/demos/templates/photo";
import { StudioTemplate, type StudioPage } from "@/demos/templates/studio";

const TEMPLATES = { editorial: EditorialTemplate, grotesk: GroteskTemplate, photo: PhotoTemplate };

/** Una demo (o una de sus páginas, si la dirección tiene varias). La usan /demo/[slug] y /demo/[slug]/[page]. */
export async function DemoView({ params }: { params: Promise<{ slug: string; page?: string }> }) {
  await connection();
  const { slug, page } = await params;
  if (!/^[a-z0-9]{10}$/.test(slug)) notFound();
  const [demo] = await db.select().from(schema.demos).where(eq(schema.demos.slug, slug));
  if (!demo || demo.status === "removed") notFound();
  // El sitio final de un cliente se exporta de su demo aunque haya vencido (firma interna, src/sites/site.ts).
  const forSite = verifySiteToken(slug, (await headers()).get("x-av-site"));
  if (!forSite && (demo.expiresAt < new Date() || demo.status === "expired")) {
    return <p className="p-10 text-center text-stone-600">Esta propuesta ya no está disponible.</p>;
  }
  const c = demo.content as DemoContent;
  const direction = directionOf(demo.template);
  // Versión de Opus o plantilla de la galería: ya revisadas; en local se ven en un marco (al publicar van como páginas propias).
  if ((c.design === "opus" && c.opus) || c.design === "galeria") {
    if (page && c.design === "opus") notFound(); // la de Opus es una sola página
    return <iframe src={`/demo/${slug}/vista${page ? `/${page}` : ""}`} title={`Propuesta para ${c.business.name}`} sandbox="allow-popups allow-top-navigation-by-user-activation" className="fixed inset-0 size-full border-0" />;
  }
  // Las páginas extra solo existen en la dirección de varias páginas.
  if (page && direction !== "studio") notFound();
  if (direction === "studio") return <StudioTemplate c={c} expiresAt={demo.expiresAt} page={(page as StudioPage) ?? "inicio"} base={`/demo/${slug}`} />;
  const Template = TEMPLATES[direction];
  return <Template c={c} expiresAt={demo.expiresAt} />;
}
