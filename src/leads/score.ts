// Puntaje de oportunidad (PLAN 6.1), código común. 0 = no vale la pena, 100 = gran oportunidad.
// Overture no trae reseñas: se usan web, contacto, señales de que el negocio existe y distancia.

export type ScoreInput = {
  webStatus: "none" | "social_only" | "unchecked" | "ok" | "outdated" | "down";
  webScore: number | null;
  phone: string | null;
  socials: string[];
  confidence: number | null;
  sourcesCount: number;
  distanceKm: number;
  radiusKm: number;
};

// Web anticuada o caída (usuario, 2026-11-10): de los mejores candidatos, porque ya quisieron tener web y se les quedó
// vieja o se les cayó. La anticuada vale lo mismo que no tener web y, cuanto más vieja, más (50 a 65); la caída, 55.
const WEB_POINTS: Record<ScoreInput["webStatus"], number> = { none: 50, down: 55, social_only: 45, unchecked: 25, ok: 0, outdated: 50 };

export function opportunityScore(i: ScoreInput): number {
  let web = WEB_POINTS[i.webStatus];
  if (i.webStatus === "outdated" && i.webScore != null) web += Math.round(((Math.max(i.webScore, 25) - 25) / 75) * 15); // 50 a 65
  const contact = (i.phone ? 15 : 0) + (i.socials.length ? 5 : 0);
  const exists = (i.confidence == null ? 7 : i.confidence * 15) + (i.sourcesCount >= 2 ? 5 : 0);
  const near = i.radiusKm > 0 ? 10 * Math.max(0, 1 - i.distanceKm / i.radiusKm) : 0;
  return Math.round(Math.min(100, web + contact + exists + near));
}

/** Distancia en km entre dos puntos (fórmula del semiverseno). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}
