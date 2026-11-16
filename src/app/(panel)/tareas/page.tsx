import { Suspense } from "react";
import { agents } from "@/agents";
import { getBackgroundPanel, getEnergyPanel, getRecentRuns, getRoutingPanel, getSupervisorPanel, ROUTING_RULE, type Run } from "@/lib/dashboard";
import { reportText } from "@/runtime/report";
import { Chip, Panel, type Tone } from "@/components/ui";
import { createTask, saveQuotaLimit, toggleBackground } from "../actions";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  idle: { label: "Libre", tone: "idle" },
  scheduled: { label: "Guardada", tone: "sleep" },
  queued: { label: "En cola", tone: "idle" },
  working: { label: "Trabajando", tone: "work" },
  waiting_approval: { label: "Espera tu OK", tone: "wait" },
  done: { label: "Terminó", tone: "work" },
  failed: { label: "Falló", tone: "stuck" },
  rejected: { label: "Rechazada", tone: "idle" },
};
const BRAIN: Record<string, string> = { code: "Código común", local: "Modelo local", claude: "Claude" };
const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id;
const taskLabel = (agentId: string, taskType: string) => agents.find((a) => a.id === agentId)?.tasks[taskType]?.label ?? taskType;

function seconds(ms: number | null | undefined) {
  return ms == null ? "–" : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`;
}

function approx(ms: number) {
  return ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : `${Math.round(ms / 60_000)} min`;
}

// Pizarrón → Tareas y cuota: modo producción, últimas tareas, lo que gasta cada tarea y encargar una nueva.
export default function TareasPage() {
  return (
    <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-6">
        <Suspense fallback={<Panel title="Últimas tareas">Cargando…</Panel>}>
          <RecentRuns />
        </Suspense>
        <Suspense fallback={<Panel title="Encargado">Cargando…</Panel>}>
          <Supervisor />
        </Suspense>
        <Suspense fallback={<Panel title="Ruteo de cerebros">Cargando…</Panel>}>
          <Routing />
        </Suspense>
      </div>
      <div className="space-y-6">
        <Suspense fallback={<Panel title="Modo producción">Cargando…</Panel>}>
          <Background />
        </Suspense>
        <NewTask />
      </div>
    </main>
  );
}

/** Encargado (PLAN 6.6): cuota por tarea, ahorro, avisos y límites diarios editables. */
async function Supervisor() {
  const p = await getSupervisorPanel();
  return (
    <Panel title="Encargado: cuota por tarea">
      <p className="mb-3 text-sm text-(--av-muted)">
        En 7 días frenó {p.blocked} {p.blocked === 1 ? "tarea duplicada o fuera de límite" : "tareas duplicadas o fuera de límite"} y reintentó {p.retried} {p.retried === 1 ? "falla pasajera" : "fallas pasajeras"}. Revisa al equipo cada 10 minutos.
      </p>
      <ul className="space-y-2">
        {p.rows.map((r) => (
          <li key={r.key} className="av-sunk flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{r.agent}</span> · {r.task}
              <span className="block text-xs text-(--av-muted)" title="Veces que usó Claude y % de la ventana de 5 horas (aproximado)">
                hoy {r.todayRuns} ({r.todayQuota}%) · 7 días {r.weekRuns} ({r.weekQuota}%)
              </span>
            </span>
            <form action={saveQuotaLimit} className="flex items-center gap-1">
              <input type="hidden" name="key" value={r.key} />
              <input name="limit" defaultValue={r.limit ?? ""} inputMode="numeric" placeholder="sin límite" aria-label={`Límite por día de ${r.task}`} className="w-24 rounded-md border-2 border-(--av-line) bg-(--av-card) px-2 py-1" />
              <button className="av-btn min-h-8 px-2 text-xs">Guardar</button>
            </form>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-(--av-muted)">Límite vacío: sin límite. 0: pausada.</p>
      {p.alerts.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">Avisos recientes ({p.alerts.length})</summary>
          <ul className="mt-2 space-y-1 text-(--av-muted)">
            {p.alerts.map((a, i) => (
              <li key={i}>
                <span className="text-xs">{a.at.toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> {a.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

const STAGE: Record<string, string> = { research: "investigar redes", final: "textos finales", draft: "borrador" };
const VERDICT: Record<string, string> = { base: "el de siempre", promoted: "ganó su lugar: va primero", demoted: "no alcanzó: se reprueba cada tanto", undecided: "a prueba" };

/** Ruteo (Fase 6): el Encargado prueba cerebros más baratos y se queda con el que aprueba seguido. */
async function Routing() {
  const stages = await getRoutingPanel();
  return (
    <Panel title="Ruteo de cerebros">
      <p className="mb-3 text-sm text-(--av-muted)">
        Antes del cerebro de siempre se prueba uno más barato. Si su respuesta no pasa los controles de la tarea, se escala. Con {ROUTING_RULE.minTries} intentos y {ROUTING_RULE.okRate * 100} % aprobados, el barato pasa a ir primero.
      </p>
      <ul className="space-y-2">
        {stages.map((s) => (
          <li key={s.key} className="av-sunk px-3 py-2 text-sm">
            <span className="font-medium">{s.agent}</span> · {s.task} ({STAGE[s.stage] ?? s.stage}) <span className="text-xs text-(--av-muted)">· {s.total} pedidos</span>
            <ul className="mt-1 text-xs text-(--av-muted)">
              {s.rungs.map((r) => (
                <li key={r.name}>
                  {r.name}: {r.tries ? `${r.ok} de ${r.tries} aprobados` : "sin intentos"}, {VERDICT[r.verdict]}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs" title="Lo resuelto con el cerebro barato contra el promedio del de siempre, menos las pruebas que no sirvieron">
              {!s.saved.measured ? "Ahorro: falta medir el de siempre." : s.saved.cheapOk === 0 && s.saved.quotaPct === 0 ? "Ahorro: todavía nada." : `Ahorro: ${s.saved.quotaPct}% de la ventana de 5 h (≈ US$ ${s.saved.usd} de referencia) en ${s.saved.cheapOk} ${s.saved.cheapOk === 1 ? "pedido" : "pedidos"}.`}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

const hour = (ms: number | null) => (ms == null ? "" : new Date(ms).toLocaleString("es-AR", { weekday: "short", hour: "2-digit", minute: "2-digit" }));

/** Energía = cuota de Claude Pro que queda (PLAN 9.5): cuándo se renueva cada ventana. La barra está en el menú. */
function Energy({ reading, level }: Awaited<ReturnType<typeof getEnergyPanel>>) {
  if (level == null || !reading) return <p className="text-xs text-(--av-muted)">Energía: sin datos todavía. Se mide la primera vez que un agente usa Claude.</p>;
  return (
    <p className="text-xs text-(--av-muted)">
      Energía {level}%, medida el {hour(reading.at)}.
      {reading.fiveHour && ` Ventana de 5 horas: usado ${reading.fiveHour.usedPct}%, se renueva el ${hour(reading.fiveHour.resetsAt)}.`}
      {reading.sevenDay && ` Semana: usado ${reading.sevenDay.usedPct}%, se renueva el ${hour(reading.sevenDay.resetsAt)}.`}
    </p>
  );
}

async function Background() {
  const [b, energy] = await Promise.all([getBackgroundPanel(), getEnergyPanel()]);
  return (
    <Panel title="Modo producción" tone={b.on ? "work" : undefined} aside={<Chip tone={b.on ? "work" : "idle"}>{b.on ? "Prendido" : "Apagado"}</Chip>}>
      <p className="text-sm">
        {b.on
          ? `Desde las ${new Date(b.since!).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}. Se apaga solo cuando terminan o se quedan sin energía.`
          : `${b.saved === 1 ? "1 tarea guardada" : `${b.saved} tareas guardadas`}${b.saved && b.batchMs ? `, ~${approx(b.batchMs)} de trabajo` : ""}. Se guardan desde Buscar.`}
      </p>
      {!b.on && b.lowEnergy && <p className="mt-1 text-sm text-amber-700">Queda poca cuota de Claude: no arranca hasta que se renueve.</p>}
      <form action={toggleBackground} className="mt-3">
        <button disabled={!b.on && (b.saved === 0 || b.lowEnergy)} className={`av-btn w-full ${b.on ? "" : "av-btn-coin"}`}>
          {b.on ? "Apagar modo producción" : "Prender modo producción"}
        </button>
      </form>
      <div className="mt-3">
        <Energy {...energy} />
      </div>
      {b.lastReport && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">Último informe, {b.lastReport.at.toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</summary>
          <p className="mt-2 whitespace-pre-wrap text-(--av-muted)">{reportText(b.lastReport.report)}</p>
        </details>
      )}
    </Panel>
  );
}

function NewTask() {
  return (
    <Panel title="Encargar una tarea">
      <form action={createTask} className="flex flex-col gap-2">
        <label className="text-sm text-(--av-muted)" htmlFor="task">
          Tareas que no necesitan elegir un negocio. Las demás se piden desde Buscar, Demos o Tienda.
        </label>
        <div className="flex gap-2">
          <select id="task" name="task" className="min-w-0 flex-1 rounded-md border-2 border-(--av-line) p-2">
            {agents.flatMap((a) =>
              Object.entries(a.tasks)
                .filter(([, t]) => !t.startsFrom)
                .map(([id, t]) => (
                  <option key={`${a.id}/${id}`} value={`${a.id}/${id}`}>
                    {a.name}: {t.label}
                  </option>
                )),
            )}
          </select>
          <button className="av-btn av-btn-coin">Encargar</button>
        </div>
      </form>
    </Panel>
  );
}

async function RecentRuns() {
  const runs = await getRecentRuns();
  return (
    <Panel title="Últimas tareas">
      <ul className="divide-y-2 divide-(--av-sunk)">
        {runs.map((r: Run) => {
          const st = STATUS[r.status];
          const detail = r.error ?? (r.output == null ? null : JSON.stringify(r.output));
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <Chip tone={st.tone}>{st.label}</Chip>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{agentName(r.agentId)}</span> · {taskLabel(r.agentId, r.taskType)}
              </span>
              <span className="text-xs text-(--av-muted)" title={r.model ?? undefined}>
                {BRAIN[r.brain]} · {seconds(r.durationMs)}
              </span>
              {detail && (
                <details className="w-full text-xs text-(--av-muted)">
                  <summary className="cursor-pointer">{r.error ? "Ver el error" : "Ver el resultado"}</summary>
                  <p className="mt-1 break-all">{detail.slice(0, 800)}</p>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
