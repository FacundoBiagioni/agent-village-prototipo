"use client";

// Ficha del agente: se abre a la derecha al tocarlo en la casa o tocar su cara arriba. Cuerpo entero, tarea, cerebro, skills, historial y mudanza.
import { asciiBody } from "@/village/office/ascii-cats";
import { FloatWindow } from "./float-window";
import { SKINS, coatFor } from "@/village/office/characters";
import { createFigure } from "@/village/office/figure";
import { useEffect, useRef } from "react";
import type { DeskSlot } from "@/village/office/layout";
import type { VillageState } from "@/village/state";
import { equipSkill } from "./actions";
import { eta, TONE, useGame, type InventorySkill, type OfficeAgent } from "./game";

const STATE: Record<VillageState, string> = {
  idle: "Libre",
  working: "Trabajando",
  moving: "Llevando una tarea",
  blocked: "Trabado: necesita ayuda",
  waiting_approval: "Espera tu aprobación",
  sleeping: "Durmiendo (sin energía)",
};
const RUN: Record<string, string> = { queued: "en cola", working: "trabajando", waiting_approval: "espera aprobación", done: "hecha", failed: "falló", rejected: "rechazada" };
const BRAIN: Record<string, string> = { code: "Código común", local: "Modelo local", claude: "Claude" };
const secs = (ms: number | null) => (ms == null ? "—" : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`);
const brainName = (b: string, m: string | null) => `${BRAIN[b] ?? b}${m ? ` (${m})` : ""}`;

export function AgentPanel(p: {
  agent: OfficeAgent;
  inventory: InventorySkill[];
  freeDesks: DeskSlot[];
  placing: boolean;
  busy: boolean;
  onPlace: () => void;
  onMove: (deskId: string) => void;
  onFocus: () => void;
  onClose: () => void;
}) {
  const { agent } = p;
  const { cfg } = useGame();
  const zones = [...new Set(p.freeDesks.map((d) => d.zone))];
  return (
    <FloatWindow id="agent" as="aside" className="hud-agent" label={`Ficha de ${agent.name}`} min={{ w: 300, h: 320 }} initial={(vw, vh) => ({ x: vw - 382, y: 104, w: 370, h: vh - 104 - 110 })}>
      <header className="hud-win-head" data-drag title="Arrastrá para mover · doble clic para volver a su lugar">
        <div>
          <h2 className="av-title">{agent.name}</h2>
          <p>{agent.role}</p>
        </div>
        <button type="button" className="hud-close" onClick={p.onClose} aria-label="Cerrar">
          ×
        </button>
      </header>
      <div className="hud-agent-body">
        <div className="hud-figure">
          {cfg.ascii.on ? <pre className="hud-acat hud-acat-body">{asciiBody(agent.id, agent.skin, cfg.coats[agent.id])}</pre> : <Figure agentId={agent.id} skin={agent.skin} species={cfg.species} coat={cfg.coats[agent.id]} pixel={cfg.pixel} />}
          <span className="hud-lvl av-title">Nv {agent.level}</span>
          <span className="hud-breed">
            {cfg.species === "gato" ? `${coatFor(agent.id, cfg.coats[agent.id]).name} · ` : ""}
            {SKINS[agent.skin]?.label ?? agent.skin}
          </span>
        </div>
        <div className="hud-xp" role="progressbar" aria-valuenow={agent.xpInLevel} aria-valuemin={0} aria-valuemax={agent.xpForNext} aria-label="Experiencia">
          <span>
            Experiencia {agent.xpInLevel}/{agent.xpForNext}
          </span>
          <span className="hud-bar">
            <b style={{ width: `${Math.round((agent.xpInLevel / agent.xpForNext) * 100)}%`, background: "var(--av-coin)" }} />
          </span>
        </div>

        <section>
          <p className="hud-state">
            <i style={{ background: TONE[agent.state] }} />
            {STATE[agent.state]}
          </p>
          {agent.task && (
            <p>
              {agent.task}
              {agent.state === "working" && ` · ${agent.stepLabel ?? "arrancando"}${agent.etaMs != null ? ` · faltan ${eta(agent.etaMs)}` : ""}`}
            </p>
          )}
          {agent.state === "working" && agent.progress != null && (
            <span className="hud-bar hud-bar-big">
              <b style={{ width: `${Math.round(agent.progress * 100)}%` }} />
            </span>
          )}
          {agent.state === "blocked" && agent.error && <p className="hud-agent-error">{agent.error}</p>}
        </section>

        <section>
          <h3>Lugar</h3>
          <p>
            {agent.desk.zone}
            {agent.desk.level === 0 && agent.desk.y > 0 ? " (entrepiso)" : ""}
          </p>
          <div className="hud-row">
            <button type="button" className="av-btn text-sm" onClick={p.onFocus}>
              Ver en la casa
            </button>
            <button type="button" className={`av-btn text-sm ${p.placing ? "av-btn-coin" : ""}`} onClick={p.onPlace} aria-pressed={p.placing}>
              {p.placing ? "Cancelar mudanza" : "Mudar de escritorio"}
            </button>
          </div>
          {p.placing && (
            <div className="hud-places">
              <p className="hud-muted">Tocá un cartel «Acá» en la casa, o elegí de la lista:</p>
              {zones.map((z) => (
                <p key={z}>
                  <span>{z}</span>
                  {p.freeDesks
                    .filter((d) => d.zone === z)
                    .map((d, i) => (
                      <button key={d.id} type="button" className="hud-chip" disabled={p.busy} onClick={() => p.onMove(d.id)}>
                        {i + 1}
                      </button>
                    ))}
                </p>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3>Cerebro de cada tarea</h3>
          <ul className="hud-list">
            {agent.brains.map((b) => (
              <li key={b.task}>
                <b>{b.task}:</b> {b.stages.length ? b.stages.map((st) => brainName(st.brain, st.model)).join(" → ") : brainName(b.brain, b.model)}
              </li>
            ))}
          </ul>
        </section>

        <SkillSlots agent={agent} inventory={p.inventory} />

        {agent.history.length > 0 && (
          <section>
            <h3>Últimas tareas</h3>
            <ul className="hud-list">
              {agent.history.map((h) => (
                <li key={h.id} className="hud-split">
                  <span>{h.task}</span>
                  <span className="hud-muted">
                    {RUN[h.status] ?? h.status} · {secs(h.durationMs)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </FloatWindow>
  );
}

/** Skills del agente (PLAN 8): las fijas de sus tareas y las equipadas, con lugares limitados por nivel. */
function SkillSlots({ agent, inventory }: { agent: OfficeAgent; inventory: InventorySkill[] }) {
  const tokens = (name: string) => inventory.find((s) => s.name === name)?.tokens ?? 0;
  const free = inventory.filter((s) => !agent.equipped.includes(s.name) && !agent.skills.includes(s.name));
  const full = agent.equipped.length >= agent.slots;
  return (
    <section>
      <h3>
        {agent.aura ? "Aura (se aplica a todos)" : "Skills equipadas"} · {agent.equipped.length}/{agent.slots} lugares
      </h3>
      <div className="hud-slots">
        {Array.from({ length: agent.slots }, (_, i) => {
          const s = agent.equipped[i];
          return s ? (
            <form key={s} action={equipSkill} className="hud-slot" data-full="">
              <input type="hidden" name="agent" value={agent.id} />
              <input type="hidden" name="skill" value={s} />
              <input type="hidden" name="remove" value="1" />
              <span title={inventory.find((x) => x.name === s)?.description}>
                {s} <small>~{tokens(s)} tokens</small>
              </span>
              <button title="Sacar" aria-label={`Sacar ${s}`}>
                ×
              </button>
            </form>
          ) : (
            <span key={i} className="hud-slot">
              libre
            </span>
          );
        })}
        <span className="hud-slot" data-locked="" title={agent.aura ? "+1 cada 5 niveles" : "+1 cada 3 niveles"}>
          más nivel
        </span>
      </div>
      {agent.skills.length > 0 && <p className="hud-muted">Fijas de sus tareas: {agent.skills.join(", ")}</p>}
      {!agent.usesAI && !agent.aura && <p className="hud-muted">No usa IA: lo que le equipes no cambia nada por ahora.</p>}
      {!full && free.length > 0 && (
        <ul className="hud-equip">
          {free.map((s) => (
            <li key={s.name}>
              <div>
                <b>{s.name}</b> <small>~{s.tokens} tokens</small>
                <p>{s.description}</p>
              </div>
              <form action={equipSkill}>
                <input type="hidden" name="agent" value={agent.id} />
                <input type="hidden" name="skill" value={s.name} />
                <button className="av-btn av-btn-coin min-h-7 px-2 text-xs">Equipar</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="hud-muted">Cada skill equipada va en todos sus pedidos a la IA: gasta esos tokens cada vez.</p>
    </section>
  );
}

/** Muñeco 3D del agente: se gira arrastrando con el mouse o con las flechas del teclado. */
function Figure(p: { agentId: string; skin: string; species: string; coat?: string; pixel: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { agentId, skin, species, coat, pixel } = p;
  useEffect(() => createFigure(ref.current!, { agentId, skin, species, coat, pixel }), [agentId, skin, species, coat, pixel]);
  return <canvas ref={ref} className="hud-figure-3d" tabIndex={0} aria-label="Muñeco del agente: arrastrá o usá las flechas para girarlo" style={{ imageRendering: pixel ? "pixelated" : "auto" }} />;
}
