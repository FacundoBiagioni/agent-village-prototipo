import { demoHtmlResponse } from "@/demos/demo-html";

/** La versión de Opus o la plantilla de la galería como página propia, para verla en local dentro del marco de /demo/[slug]. */
export async function GET(_req: Request, { params }: RouteContext<"/demo/[slug]/vista">) {
  return demoHtmlResponse((await params).slug, "inicio");
}
