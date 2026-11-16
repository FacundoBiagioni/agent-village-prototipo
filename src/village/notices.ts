// Centro de avisos y contadores del HUD (reforma 2026-11-10). Funciones puras: reciben lo que hay pendiente y arman
// qué número va en cada botón y qué avisos se listan en la campana. El servidor junta los datos (lib/hud.ts).

export type Menu = "bandeja" | "negocios" | "taller" | "contacto" | "caja" | "pizarron" | "tienda";
export type Pending = {
  approvals: number;
  templatesToReview: number;
  messagesToSend: number;
  visitsToday: number;
  visitsOverdue: number;
  paymentsOverdue: number;
  blocked: { id: string; name: string }[];
  waiting: { id: string; name: string }[];
  /** El modo producción dejó un informe hace menos de un día. */
  freshReport: boolean;
  /** Energía (cuota de Claude) que queda, 0 a 100; null = sin datos. */
  energy: number | null;
};
export type Notice = { tone: "wait" | "stuck" | "info" | "work"; text: string; href?: string; agent?: string };

const n = (count: number, one: string, many: string) => (count === 1 ? one : many.replace("#", String(count)));

/** El número de cada botón de abajo (y del objeto de la casa que abre el mismo menú). */
export function badgesOf(p: Pending): Record<Menu, number> {
  return {
    bandeja: p.approvals,
    negocios: 0,
    taller: p.templatesToReview,
    contacto: p.messagesToSend + p.visitsToday + p.visitsOverdue,
    caja: p.paymentsOverdue,
    pizarron: p.blocked.length,
    tienda: 0,
  };
}

/** Avisos de la campana, de lo más urgente a lo informativo. */
export function noticesOf(p: Pending): Notice[] {
  const out: Notice[] = [];
  for (const a of p.blocked) out.push({ tone: "stuck", text: `${a.name} se trabó y necesita ayuda`, agent: a.id });
  if (p.approvals) out.push({ tone: "wait", text: n(p.approvals, "1 pedido espera tu aprobación", "# pedidos esperan tu aprobación"), href: "/bandeja" });
  if (p.paymentsOverdue) out.push({ tone: "stuck", text: n(p.paymentsOverdue, "1 cobro vencido", "# cobros vencidos"), href: "/ventas" });
  if (p.visitsOverdue) out.push({ tone: "stuck", text: n(p.visitsOverdue, "1 visita para volver se pasó de fecha", "# visitas para volver se pasaron de fecha"), href: "/visitas" });
  if (p.visitsToday) out.push({ tone: "wait", text: n(p.visitsToday, "1 visita para hoy", "# visitas para hoy"), href: "/visitas" });
  if (p.messagesToSend) out.push({ tone: "wait", text: n(p.messagesToSend, "1 mensaje aprobado, listo para mandar", "# mensajes aprobados, listos para mandar"), href: "/mensajes" });
  if (p.templatesToReview) out.push({ tone: "info", text: n(p.templatesToReview, "1 plantilla nueva para revisar", "# plantillas nuevas para revisar"), href: "/plantillas" });
  if (p.energy != null && p.energy <= 20) out.push({ tone: "stuck", text: `Queda poca energía (${p.energy}%): la cuota de Claude está por agotarse`, href: "/tareas" });
  if (p.freshReport) out.push({ tone: "info", text: "El modo producción dejó un informe", href: "/tareas" });
  return out;
}
