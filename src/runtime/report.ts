export type StopReason = "done" | "user" | "energy";
export type Report = { reason: StopReason; done: number; failed: number; waiting: number; leftSaved: number; failures: string[]; minutes: number; quota?: { fiveHour: [number, number] | null; sevenDay: [number, number] | null } };

const REASON: Record<StopReason, string> = { done: "terminaron todo", user: "lo apagaste", energy: "se quedaron sin energía (cuota de Claude)" };

/** Informe del modo producción (el "informe matutino" del PLAN 9.3): qué se hizo, qué se trabó y qué espera tu aprobación. */
export function reportText(r: Report) {
  return [
    `Modo producción apagado: ${REASON[r.reason]}. Duró ${r.minutes} min.`,
    `Hechas: ${r.done}. Trabadas: ${r.failed}. Esperan tu aprobación: ${r.waiting}.`,
    r.leftSaved ? `Quedaron ${r.leftSaved} guardadas para la próxima.` : "",
    quotaLine(r.quota),
    ...r.failures.map((f) => `- ${f}`),
  ]
    .filter(Boolean)
    .join("\n");
}

const span = (label: string, w: [number, number] | null | undefined) => (w ? `${label} ${w[0]}% → ${w[1]}%` : "");
function quotaLine(q: Report["quota"]) {
  const parts = [span("5 h", q?.fiveHour), span("semana", q?.sevenDay)].filter(Boolean);
  return parts.length ? `Cuota de Claude usada: ${parts.join(", ")}.` : "";
}
