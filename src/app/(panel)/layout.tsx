import { Suspense } from "react";
import { PANEL_ID } from "@/components/theme";
import { panelFonts } from "@/components/fonts";
import { NoServiceWorker } from "@/components/no-service-worker";
import { getAgentStates, getBackgroundPanel, getEnergyPanel, getOfficeConfig, getSkillInventory } from "@/lib/dashboard";
import { getPending } from "@/lib/hud";
import { badgesOf, noticesOf } from "@/village/notices";
import { allDesks, assignDesks } from "@/village/office/layout";
import { GameClient } from "./game";
import "./hud.css";

/** La casa con su HUD: los agentes reales en sus escritorios y lo pendiente de cada menú. La página de cada ruta va adentro, como ventana. */
async function Game({ children }: { children: React.ReactNode }) {
  const [states, energy, config, background, inventory] = await Promise.all([getAgentStates(), getEnergyPanel(), getOfficeConfig(), getBackgroundPanel(), getSkillInventory()]);
  const seats = assignDesks(states.map((s) => s.agent.id), config.desks, config.basements.length);
  const taken = new Set(Object.values(seats).map((d) => d.id));
  const agents = states.map(({ agent, run, etaMs, state, level, xpInLevel, xpForNext, movingTo, history, equipped, slots }) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    desk: seats[agent.id],
    skin: agent.world.skin,
    state,
    level,
    xpInLevel,
    xpForNext,
    progress: run?.status === "working" && run.stepsTotal ? run.stepIndex / run.stepsTotal : null,
    etaMs,
    stepLabel: run?.stepLabel ?? null,
    task: run ? (agent.tasks[run.taskType] ?? run.taskType) : null,
    brains: agent.brains,
    error: run?.error ?? null,
    movingTo: movingTo ? (seats[movingTo] ?? null) : null,
    patrol: !!agent.world.patrol,
    skills: agent.skills,
    equipped,
    slots,
    usesAI: agent.usesAI,
    aura: agent.id === "encargado",
    history: history.map((h) => ({ id: h.id, task: agent.tasks[h.taskType] ?? h.taskType, status: h.status, durationMs: h.durationMs, createdAt: h.createdAt })),
  }));
  const pending = await getPending(agents, energy.level);
  return (
    <GameClient
      config={config}
      energy={energy.level}
      agents={agents}
      freeDesks={allDesks(config.basements.length).filter((d) => !taken.has(d.id))}
      inventory={inventory}
      production={{ on: background.on, saved: background.saved, lowEnergy: background.lowEnergy }}
      badges={badgesOf(pending)}
      notices={noticesOf(pending)}
    >
      {children}
    </GameClient>
  );
}

// Panel de trabajo del usuario (las demos públicas no pasan por acá).
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id={PANEL_ID} className={`${panelFonts} hud-root`}>
      <NoServiceWorker />
      <Suspense fallback={<p className="hud-loading av-title">Abriendo la casa…</p>}>
        <Game>{children}</Game>
      </Suspense>
    </div>
  );
}
