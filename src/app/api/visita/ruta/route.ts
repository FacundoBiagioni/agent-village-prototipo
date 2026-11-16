import { DEFAULT_CENTER } from "@/leads/search";
import { requireSession } from "@/lib/session";
import { routeForToday } from "@/visits/store";

/** Ruta del día para el celular. ?n=10&lat=..&lng=.. (sin lat/lng: el centro de La Plata). */
export async function GET(request: Request) {
  await requireSession();
  const q = new URL(request.url).searchParams;
  const num = (k: string, def: number, min: number, max: number) => {
    const v = Number(q.get(k));
    return Number.isFinite(v) && q.get(k) !== null && v >= min && v <= max ? v : def;
  };
  const start = { lat: num("lat", DEFAULT_CENTER.lat, -90, 90), lng: num("lng", DEFAULT_CENTER.lng, -180, 180) };
  const stops = await routeForToday(start, Math.round(num("n", 10, 1, 30)));
  return Response.json({ createdAt: new Date().toISOString(), start, stops });
}
