// Métricas de venta (Fase 4): código común sobre lo que ya queda registrado (demos, mensajes, visitas, ventas).

/** Localidades del Gran La Plata (centro aproximado). La zona de un negocio es la más cercana. */
// shortcut: centros aproximados a mano; si hace falta precisión, importar la localidad de Overture (addresses.locality).
const ZONES: [string, number, number][] = [
  ["Casco urbano", -34.9214, -57.9545],
  ["Tolosa", -34.899, -57.97],
  ["Gonnet", -34.881, -58.018],
  ["City Bell", -34.8686, -58.051],
  ["Villa Elisa", -34.85, -58.083],
  ["Los Hornos", -34.957, -57.99],
  ["San Carlos", -34.94, -58.0],
  ["Villa Elvira", -34.945, -57.92],
  ["Altos de San Lorenzo", -34.955, -57.935],
  ["Berisso", -34.873, -57.886],
  ["Ensenada", -34.864, -57.912],
];

export function zoneOf(lat: number, lng: number): string {
  let best = ZONES[0];
  let bestD = Infinity;
  for (const z of ZONES) {
    const d = (z[1] - lat) ** 2 + ((z[2] - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) [best, bestD] = [z, d];
  }
  return best[0];
}

export const LOSS_REASONS = ["No respondió", "No le interesa", "Ya tiene quien le haga la web", "Le pareció caro", "Otro"] as const;

/** Un negocio con lo que pasó con él. Las fechas solo se usan para saber el canal del primer contacto. */
export type LeadFacts = {
  niche: string | null;
  lat: number;
  lng: number;
  stage: string;
  lostReason: string | null;
  hasDemo: boolean;
  firstMessageAt: Date | null;
  firstVisitAt: Date | null;
  gotReply: boolean;
  isClient: boolean;
};

const REPLIED = ["replied", "closed", "paying", "hosted"];
const CLOSED = ["closed", "paying", "hosted"];

export type Group = { key: string; contacted: number; replied: number; closed: number; lost: number };

export function computeMetrics(leads: LeadFacts[]) {
  const facts = leads.map((l) => {
    const closed = l.isClient || CLOSED.includes(l.stage);
    const replied = closed || l.gotReply || REPLIED.includes(l.stage);
    const contacted = replied || !!l.firstMessageAt || !!l.firstVisitAt || l.stage === "contacted";
    const lost = l.stage === "lost" || l.stage === "do_not_contact";
    const channel =
      l.firstMessageAt && (!l.firstVisitAt || l.firstMessageAt <= l.firstVisitAt) ? "WhatsApp" : l.firstVisitAt ? "Visita" : "Sin registrar";
    return { ...l, closed, replied, contacted, lost, channel, zone: zoneOf(l.lat, l.lng) };
  });

  const funnel = {
    demo: facts.filter((f) => f.hasDemo).length,
    contacted: facts.filter((f) => f.contacted).length,
    replied: facts.filter((f) => f.replied).length,
    closed: facts.filter((f) => f.closed).length,
  };

  const groupBy = (keyOf: (f: (typeof facts)[number]) => string): Group[] => {
    const m = new Map<string, Group>();
    for (const f of facts.filter((x) => x.contacted)) {
      const key = keyOf(f);
      const g = m.get(key) ?? { key, contacted: 0, replied: 0, closed: 0, lost: 0 };
      g.contacted++;
      if (f.replied) g.replied++;
      if (f.closed) g.closed++;
      if (f.lost) g.lost++;
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) => b.contacted - a.contacted || a.key.localeCompare(b.key));
  };

  const reasons = new Map<string, number>();
  for (const f of facts.filter((x) => x.lost)) {
    const r = f.lostReason ?? (f.stage === "do_not_contact" ? "Pidió no ser contactado" : "Sin motivo anotado");
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }

  return {
    funnel,
    byNiche: groupBy((f) => f.niche ?? "Sin rubro"),
    byZone: groupBy((f) => f.zone),
    byChannel: groupBy((f) => f.channel),
    lossReasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}
