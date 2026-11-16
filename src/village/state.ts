// Estado que muestra el pueblo (PLAN 9.1). Funciones puras: el renderizador (cualquiera sea el estilo) solo lee esto.

export type VillageState = "idle" | "working" | "moving" | "blocked" | "waiting_approval" | "sleeping";

type RunLike = { status: string; startedAt: Date | null; finishedAt: Date | null };

export const MOVING_MS = 10_000; // cuánto se lo ve "llevando la tarea" a otro agente
export const MIN_VISIBLE_MS = 8_000; // una tarea instantánea (código común, ms) se ve al menos esto en la oficina
const STUCK_MIN_MS = 10 * 60_000; // nunca se lo da por trabado antes de 10 minutos trabajando

/** Estado del agente a partir de su última ejecución.
 *  - moving: acaba de pasarle una tarea a otro agente. Va antes que "working": en el modo producción el Analista
 *    arranca el negocio siguiente en el mismo instante, y si no, el pase no se vería nunca (2026-11-07).
 *  - working: trabajando, o terminó hace un momento una tarea instantánea (se ve MIN_VISIBLE_MS desde que empezó).
 *  - blocked: la última falló, o lleva el triple de lo normal (y más de 10 min) sin terminar.
 *  - sleeping: sin energía (cuota de Claude agotada). */
export function villageState(o: { run?: RunLike; now: number; medianMs?: number | null; handedOffAt?: Date | null; outOfEnergy?: boolean }): VillageState {
  const { run, now } = o;
  if (run?.status === "waiting_approval") return "waiting_approval";
  if (o.handedOffAt && now - o.handedOffAt.getTime() < MOVING_MS) return "moving";
  if (run?.status === "working") {
    const elapsed = run.startedAt ? now - run.startedAt.getTime() : 0;
    return elapsed > Math.max(STUCK_MIN_MS, 3 * (o.medianMs ?? 0)) ? "blocked" : "working";
  }
  if (run?.status === "done" && run.startedAt && now - run.startedAt.getTime() < MIN_VISIBLE_MS) return "working";
  if (run?.status === "failed") return "blocked";
  if (o.outOfEnergy) return "sleeping";
  return "idle";
}

// Experiencia por resultados reales (PLAN 9.5). Se calcula desde la base, no se guarda: no se desincroniza.
export const XP = { taskDone: 10, approved: 25, demoPublished: 25, replied: 50, client: 150 } as const;

/** Nivel 1 con 0 XP; cada nivel pide 100 XP más que el anterior (100, 200, 300...). */
export function levelFor(xp: number) {
  let level = 1;
  let need = 100;
  let base = 0;
  while (xp >= base + need) {
    base += need;
    level++;
    need = level * 100;
  }
  return { level, xpInLevel: xp - base, xpForNext: need };
}

/** "Empieza en ~X" para las tareas en cola. El worker hace una por vez, en orden de llegada:
 *  cada una espera lo que le falta a la actual más la mediana de las que tiene adelante.
 *  null = no se puede estimar (alguna de adelante no tiene historial). */
export function queueStartsIn(currentRemainingMs: number, queuedMedians: (number | null)[]): (number | null)[] {
  let acc: number | null = currentRemainingMs;
  return queuedMedians.map((m) => {
    const startsIn = acc;
    acc = acc == null || m == null ? null : acc + m;
    return startsIn;
  });
}
