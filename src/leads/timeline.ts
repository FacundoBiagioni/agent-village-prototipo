// Recorrido de un negocio para su ficha: de "encontrado" a "cliente", con lo que ya pasó y lo que sigue. Función pura.

export type TimelineInput = {
  stage: string;
  createdAt: Date;
  webCheckedAt: Date | null;
  demo: { status: string; createdAt: Date } | null;
  message: { status: string; createdAt: Date; sentAt: Date | null; repliedAt: Date | null } | null;
  visit: { result: string; visitedAt: Date; comeBackOn: string | null } | null;
  client: { createdAt: Date } | null;
};
export type Step = { label: string; done: boolean; at: Date | null; detail?: string };

const MESSAGE: Record<string, string> = { pending_approval: "espera tu aprobación en la bandeja", approved: "aprobado, falta mandarlo", sent: "enviado", rejected: "rechazado" };
const VISIT: Record<string, string> = { interested: "le interesó", come_back: "volver otro día", not_interested: "no le interesa" };
const DEMO: Record<string, string> = { draft: "lista", approved: "aprobada", published: "publicada", expired: "vencida", removed: "retirada" };
const ANALYZED = ["analyzed", "demo_created", "contacted", "replied", "closed", "paying", "hosted"];

/** Los seis pasos, siempre en el mismo orden. Un paso de más adelante hecho no marca los de antes (una venta en persona puede no tener mensaje). */
export function timelineOf(i: TimelineInput): Step[] {
  const sent = i.message?.status === "sent";
  return [
    { label: "Encontrado", done: true, at: i.createdAt },
    { label: "Analizado", done: ANALYZED.includes(i.stage) || !!i.demo, at: i.webCheckedAt },
    { label: "Demo", done: !!i.demo && i.demo.status !== "removed", at: i.demo?.createdAt ?? null, detail: i.demo ? DEMO[i.demo.status] : undefined },
    { label: "Mensaje", done: sent, at: i.message ? (i.message.sentAt ?? i.message.createdAt) : null, detail: i.message ? `${MESSAGE[i.message.status]}${i.message.repliedAt ? ", respondió" : ""}` : undefined },
    { label: "Visita", done: !!i.visit, at: i.visit?.visitedAt ?? null, detail: i.visit ? `${VISIT[i.visit.result]}${i.visit.result === "come_back" && i.visit.comeBackOn ? ` (${i.visit.comeBackOn.split("-").reverse().join("/")})` : ""}` : undefined },
    { label: "Cliente", done: !!i.client, at: i.client?.createdAt ?? null },
  ];
}

/** El primer paso que falta (el que se resalta como "ahora"); -1 si ya es cliente o el negocio se cerró. */
export function nextStep(steps: Step[], stage: string) {
  if (stage === "lost" || stage === "do_not_contact") return -1;
  return steps.findIndex((s) => !s.done);
}
