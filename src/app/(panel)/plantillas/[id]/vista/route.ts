import { previewResponse } from "../../preview";

/** Vista previa de una plantilla rellenada con un negocio de ejemplo del rubro (solo en el panel, con sesión). */
export async function GET(_req: Request, { params }: RouteContext<"/plantillas/[id]/vista">) {
  return previewResponse((await params).id, "inicio");
}
