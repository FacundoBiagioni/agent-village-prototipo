import { previewResponse } from "../../../preview";

export async function GET(_req: Request, { params }: RouteContext<"/plantillas/[id]/vista/[page]">) {
  const { id, page } = await params;
  return previewResponse(id, page);
}
