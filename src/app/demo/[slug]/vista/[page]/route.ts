import { demoHtmlResponse } from "@/demos/demo-html";

/** Otras páginas de una plantilla de varias páginas (servicios, nosotros…), dentro del marco de la demo. */
export async function GET(_req: Request, { params }: RouteContext<"/demo/[slug]/vista/[page]">) {
  const { slug, page } = await params;
  return demoHtmlResponse(slug, page);
}
