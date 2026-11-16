import { requireSession } from "@/lib/session";
import { SANDBOX_HEADERS } from "@/demos/demo-html";
import { renderTemplate, type TemplateNiche } from "@/demos/gallery";
import { asTemplate, getTemplate, sampleContent } from "@/demos/gallery-store";

/** Una página de la plantilla con los datos de un negocio de ejemplo del rubro. Sin scripts (sandbox), como las demos. */
export async function previewResponse(id: string, page: string) {
  await requireSession();
  const row = await getTemplate(id);
  if (!row || !/^[a-z]+$/.test(page)) return new Response("No existe", { status: 404 });
  const sample = await sampleContent(row.niche as TemplateNiche);
  const html = renderTemplate(asTemplate(row), sample, new Date(Date.now() + 21 * 86_400_000), `/plantillas/${id}/vista`).pages[page];
  return html ? new Response(html, { headers: SANDBOX_HEADERS }) : new Response("No existe", { status: 404 });
}
