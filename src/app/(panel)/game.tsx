"use client";

// La casa a pantalla completa con su HUD de juego (reforma 2026-11-10): arriba el estado, abajo los menús con contador,
// las pantallas de siempre se abren como ventanas flotantes y la casa sigue viva atrás.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import type { OfficeConfig } from "@/lib/dashboard";
import type { Menu, Notice } from "@/village/notices";
import { asciiHead } from "@/village/office/ascii-cats";
import { BASEMENT_VARIANTS, floorName, floorShort, MAX_BASEMENTS, type DeskSlot } from "@/village/office/layout";
import { createOffice, type Picked, type Portraits } from "@/village/office/scene";
import type { VillageState } from "@/village/state";
import { addBasement, deleteBasement, moveAgent, searchBusinesses, setOfficeConfig, toggleBackground } from "./actions";
import { AgentPanel } from "./agent-panel";
import { FloatWindow } from "./float-window";
import { HudIcon } from "./hud-icons";

export type OfficeAgent = {
  id: string;
  name: string;
  role: string;
  desk: DeskSlot;
  skin: string;
  state: VillageState;
  level: number;
  xpInLevel: number;
  xpForNext: number;
  progress: number | null;
  etaMs: number | null;
  stepLabel: string | null;
  task: string | null;
  brains: { task: string; brain: string; model: string | null; stages: { brain: string; model: string | null }[] }[];
  error: string | null;
  movingTo: DeskSlot | null;
  patrol: boolean;
  skills: string[];
  equipped: string[];
  slots: number;
  usesAI: boolean;
  aura: boolean;
  history: { id: string; task: string; status: string; durationMs: number | null; createdAt: Date }[];
};
export type Production = { on: boolean; saved: number; lowEnergy: boolean };
export type InventorySkill = { name: string; description: string; tokens: number };
type Found = Awaited<ReturnType<typeof searchBusinesses>>;

const LABEL: Record<VillageState, string> = { idle: "libre", working: "trabajando", moving: "llevando una tarea", blocked: "¡trabado!", waiting_approval: "espera tu OK", sleeping: "sin energía" };
export const TONE: Record<VillageState, string> = { idle: "var(--av-idle)", working: "var(--av-work)", moving: "var(--av-work)", blocked: "var(--av-stuck)", waiting_approval: "var(--av-wait)", sleeping: "var(--av-sleep)" };
export const eta = (ms: number | null) => (ms == null ? null : ms < 60_000 ? `~${Math.max(1, Math.round(ms / 1000))}s` : `~${Math.round(ms / 60_000)}min`);

/** Tiempo estimado que baja solo en pantalla (2026-11-16). Antes la página entera se volvía a pedir cada 5 s para
 *  actualizarlo y eso frenaba la casa; ahora solo se redibuja este texto. Cada dato nuevo del servidor lo reinicia. */
export function Eta({ ms, prefix = "" }: { ms: number | null; prefix?: string }) {
  const [seen, setSeen] = useState(ms);
  const [elapsed, setElapsed] = useState(0);
  if (seen !== ms) {
    setSeen(ms);
    setElapsed(0);
  }
  useEffect(() => {
    if (ms == null) return;
    const start = performance.now();
    const t = setInterval(() => setElapsed(performance.now() - start), 1000);
    return () => clearInterval(t);
  }, [ms]);
  const text = eta(ms == null ? null : Math.max(0, ms - elapsed));
  return text ? <>{prefix}{text}</> : null;
}

/** Los menús: cada uno agrupa pantallas (pestañas) y tiene su objeto en la casa. */
const SECTIONS: { id: Menu | "ajustes" | "skins"; label: string; href: string; tabs: [string, string][]; wide?: boolean }[] = [
  { id: "bandeja", label: "Bandeja", href: "/bandeja", tabs: [["/bandeja", "Bandeja"]] },
  { id: "negocios", label: "Negocios", href: "/buscar", tabs: [["/buscar", "Buscar"], ["/negocios", "Ficha"]], wide: true },
  { id: "taller", label: "Taller", href: "/demos", tabs: [["/demos", "Demos"], ["/plantillas", "Plantillas"]], wide: true },
  { id: "contacto", label: "Contacto", href: "/mensajes", tabs: [["/mensajes", "Mensajes"], ["/visitas", "Visitas"]] },
  { id: "caja", label: "Caja", href: "/ventas", tabs: [["/ventas", "Ventas y cobros"]] },
  { id: "pizarron", label: "Pizarrón", href: "/metricas", tabs: [["/metricas", "Métricas"], ["/tareas", "Tareas y cuota"]] },
  { id: "tienda", label: "Tienda", href: "/tienda", tabs: [["/tienda", "Tienda de skills"]] },
  { id: "ajustes", label: "Ajustes", href: "/ajustes", tabs: [["/ajustes", "Ajustes"], ["/respaldo", "Copia de seguridad"]] },
  { id: "skins", label: "Skins", href: "/skins", tabs: [["/skins", "Skins"]], wide: true },
];
const VIEW_BUTTONS = [
  { id: "left", label: "⟲", title: "Girar a la izquierda" },
  { id: "right", label: "⟳", title: "Girar a la derecha" },
  { id: "in", label: "+", title: "Acercar" },
  { id: "out", label: "−", title: "Alejar" },
  { id: "home", label: "⌂", title: "Volver a la vista inicial" },
] as const;
const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);
const sectionOf = (path: string) => SECTIONS.find((s) => s.tabs.some(([href]) => under(path, href)));

type Look = Pick<OfficeConfig, "species" | "light" | "pixel" | "ascii" | "houseTheme" | "uiTheme" | "background">;
type Game = { cfg: OfficeConfig; change: (patch: Partial<Look>) => void; portraits: Portraits };
const GameContext = createContext<Game | null>(null);
/** Para las pantallas que cambian cómo se ve la casa (Ajustes). */
export const useGame = () => useContext(GameContext)!;

export function GameClient(p: {
  config: OfficeConfig;
  energy: number | null;
  agents: OfficeAgent[];
  freeDesks: DeskSlot[];
  inventory: InventorySkill[];
  production: Production;
  badges: Record<Menu, number>;
  notices: Notice[];
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const office = useRef<ReturnType<typeof createOffice> | null>(null);
  // El aspecto se cambia acá al instante; lo que guarda el servidor (sótanos, escritorios) llega por props.
  const [look, setLook] = useState<Look>({ species: p.config.species, light: p.config.light, pixel: p.config.pixel, ascii: p.config.ascii, houseTheme: p.config.houseTheme, uiTheme: p.config.uiTheme, background: p.config.background });
  const cfg = useMemo<OfficeConfig>(() => ({ ...p.config, ...look }), [p.config, look]);
  const [picked, setPicked] = useState<string | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [open, setOpen] = useState<"" | "notices" | "levels" | "search">("");
  const [portraits, setPortraits] = useState<Portraits>({});
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(0);
  const basements = p.config.basements;
  const ascii = cfg.ascii.on;

  useEffect(() => {
    const onPick = (x: Picked) => {
      setOpen("");
      if (x?.startsWith("menu:")) {
        const s = SECTIONS.find((sec) => sec.id === x.slice(5));
        if (s) router.push(s.href);
      } else if (x && x !== "pet") setPicked(x);
      else if (!x) setPicked(null);
    };
    office.current = createOffice(canvas.current!, onPick, labels.current!, setPortraits);
    return () => office.current?.dispose();
  }, [router]);
  useEffect(() => {
    office.current?.update({
      species: cfg.species,
      houseTheme: cfg.houseTheme,
      background: cfg.background,
      light: cfg.light,
      pixel: cfg.pixel,
      ascii: cfg.ascii,
      basements,
      basementNames: p.config.names.basements,
      coats: p.config.coats,
      level: Math.min(level, basements.length),
      energy: p.energy ?? 100,
      waitingApproval: p.badges.bandeja > 0,
      contactPending: p.badges.contacto > 0,
      agents: p.agents.map((a) => ({ id: a.id, name: a.name, desk: a.desk, skin: a.skin, state: a.state, movingTo: a.movingTo, patrol: a.patrol })),
    });
  }, [cfg.species, cfg.houseTheme, cfg.background, cfg.light, cfg.pixel, cfg.ascii, basements, p.config.names.basements, p.config.coats, level, p.energy, p.badges.bandeja, p.badges.contacto, p.agents]);

  const change: Game["change"] = (patch) => {
    setLook((c) => ({ ...c, ...patch, ascii: { ...c.ascii, ...patch.ascii } }));
    startBusy(() => setOfficeConfig(patch));
  };
  const game = { cfg, change, portraits };
  const act = (fn: () => Promise<unknown>) =>
    startBusy(async () => {
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo hacer");
      }
    });

  const section = path === "/" ? undefined : sectionOf(path);
  const windowOpen = path !== "/";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === "Escape") {
        if (open) setOpen("");
        else if (placing) setPlacing(null);
        else if (picked) setPicked(null);
        else if (windowOpen && !typing) router.push("/");
      } else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && /^[1-7]$/.test(e.key)) router.push(SECTIONS[Number(e.key) - 1].href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, placing, picked, windowOpen, router]);

  function viewAction(id: (typeof VIEW_BUTTONS)[number]["id"]) {
    const o = office.current;
    if (!o) return;
    if (id === "left") o.rotate(-Math.PI / 4);
    else if (id === "right") o.rotate(Math.PI / 4);
    else if (id === "in") o.zoom(1.25);
    else if (id === "out") o.zoom(0.8);
    else o.reset();
  }
  const agent = p.agents.find((a) => a.id === picked);
  const working = p.agents.some((a) => a.state === "working" || a.state === "moving");
  const goToAgent = (a: OfficeAgent) => {
    setPicked(a.id);
    setOpen("");
    if (level > a.desk.level) setLevel(a.desk.level);
    setTimeout(() => office.current?.focusAgent(a.id), 60);
  };

  return (
    <GameContext.Provider value={game}>
      <div className="hud" data-ui={cfg.uiTheme} data-ascii={ascii ? "" : undefined} data-working={working ? "" : undefined} data-window={windowOpen ? "" : undefined}>
        <canvas ref={canvas} className="hud-canvas" aria-label="La casa de los agentes. Arrastrá para moverla, botón derecho para girarla, rueda para acercar. Tocá un agente o un objeto." />

        {/* Carteles sobre la casa: la escena los ubica; acá solo el contenido. */}
        <div ref={labels} className="hud-labels">
          {p.agents.map((a) => (
            <button key={a.id} type="button" data-label={a.id} className="hud-tag" data-active={a.state !== "idle" && a.state !== "sleeping" ? "" : undefined} onClick={() => setPicked(a.id)}>
              <span className="av-title">{a.name}</span> <span className="hud-muted">nv {a.level}</span>
              <span className="hud-tag-state">
                <i style={{ background: TONE[a.state] }} />
                {a.state === "working" ? (
                  <>
                    <span className="hud-tag-step">{a.stepLabel ?? "arrancando"}</span>
                    {a.progress != null && (
                      <span className="hud-bar">
                        <b style={{ width: `${Math.round(a.progress * 100)}%` }} />
                      </span>
                    )}
                    {a.etaMs != null && <span className="hud-muted"><Eta ms={a.etaMs} /></span>}
                  </>
                ) : (
                  LABEL[a.state]
                )}
              </span>
            </button>
          ))}
          {placing &&
            p.freeDesks.map((d) => (
              <button key={d.id} type="button" data-anchor={`${d.x},${d.y + 1.5},${d.z}`} data-level={d.level} className="hud-free" disabled={busy} onClick={() => act(() => moveAgent(placing, d.id).then(() => setPlacing(null)))}>
                Acá
              </button>
            ))}
        </div>

        {/* Arriba: quiénes están y cómo, energía, modo producción, hora, búsqueda, avisos y ajustes. */}
        <header className="hud-top">
          <Link href="/" className="hud-brand" title="Volver a la casa">
            <span className="hud-logo">
              <HudIcon name="negocios" size={20} />
            </span>
            <span className="av-title">Agent Village</span>
          </Link>
          <div className="hud-faces" aria-label="Agentes">
            {p.agents.map((a) => (
              <button key={a.id} type="button" className="hud-face" aria-pressed={picked === a.id} title={`${a.name}: ${LABEL[a.state]}`} onClick={() => goToAgent(a)}>
                <span className="hud-face-pic">
                  {ascii ? (
                    <pre className="hud-acat">{asciiHead(a.id, a.skin, cfg.coats[a.id])}</pre>
                  ) : portraits[a.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- retrato generado en el navegador (data URL)
                    <img src={portraits[a.id].head} alt="" />
                  ) : null}
                </span>
                <i style={{ background: TONE[a.state] }} />
                <span>{a.name}</span>
              </button>
            ))}
            <span className="hud-face hud-face-free" title="Escritorios libres para los agentes que vengan">
              <span className="hud-face-pic">+{p.freeDesks.length}</span>
              <span>libres</span>
            </span>
          </div>
          <div className="hud-stats">
            <Energy level={p.energy} />
            <form action={toggleBackground}>
              <button
                className="hud-prod"
                aria-pressed={p.production.on}
                disabled={!p.production.on && (p.production.saved === 0 || p.production.lowEnergy)}
                title={p.production.on ? "Apagarlo: terminan lo que están haciendo y paran" : p.production.saved === 0 ? "No hay tareas guardadas: se guardan desde Buscar" : p.production.lowEnergy ? "Queda poca cuota de Claude" : "Los agentes hacen solos las tareas guardadas"}
              >
                <i />
                <span>
                  Producción <small>{p.production.on ? "prendido" : `${p.production.saved} guardada${p.production.saved === 1 ? "" : "s"}`}</small>
                </span>
              </button>
            </form>
            <Clock />
          </div>
          <div className="hud-tools">
            <LiveRefresh />
            <button type="button" className="hud-tool" title="Buscar un negocio" aria-expanded={open === "search"} onClick={() => setOpen(open === "search" ? "" : "search")}>
              <HudIcon name="search" size={24} />
            </button>
            <button type="button" className="hud-tool" title="Avisos" aria-expanded={open === "notices"} onClick={() => setOpen(open === "notices" ? "" : "notices")}>
              <HudIcon name="bell" size={24} />
              {p.notices.length > 0 && <span className="hud-badge">{p.notices.length}</span>}
            </button>
            <Link href={under(path, "/ajustes") ? "/" : "/ajustes"} className="hud-tool" title="Ajustes">
              <HudIcon name="gear" size={24} />
            </Link>
          </div>
        </header>

        {open === "notices" && (
          <FloatWindow id="notices" className="hud-pop hud-notices" role="dialog" label="Avisos" as="div" min={{ w: 280, h: 140 }} initial={(vw) => ({ x: vw - 400, y: 104, w: 380 })}>
            <PopHead title="Avisos" onClose={() => setOpen("")} />
            {p.notices.length === 0 && <p className="hud-muted">Todo al día. Si un agente necesita algo, aparece acá.</p>}
            {p.notices.map((n, i) => {
              const a = n.agent && p.agents.find((x) => x.id === n.agent);
              const body = (
                <>
                  <i data-tone={n.tone} />
                  <span>{n.text}</span>
                </>
              );
              return a ? (
                <button key={i} type="button" className="hud-notice" onClick={() => goToAgent(a)}>
                  {body}
                </button>
              ) : (
                <Link key={i} href={n.href ?? "/"} className="hud-notice" onClick={() => setOpen("")}>
                  {body}
                </Link>
              );
            })}
          </FloatWindow>
        )}
        {open === "search" && <Search close={() => setOpen("")} />}

        {/* Abajo: los menús. Cada uno muestra cuánto hay pendiente ahí. */}
        <nav className="hud-dock" aria-label="Menús">
          {SECTIONS.slice(0, 7).map((s, i) => (
            <Link key={s.id} href={section?.id === s.id ? "/" : s.href} className="hud-dock-btn" aria-current={section?.id === s.id ? "page" : undefined} title={`${s.label} (tecla ${i + 1})`}>
              <HudIcon name={s.id} size={36} />
              <span className="av-title">{s.label}</span>
              {p.badges[s.id as Menu] > 0 && <span className="hud-badge">{p.badges[s.id as Menu]}</span>}
            </Link>
          ))}
        </nav>

        {/* Plantas y vista. */}
        <div className="hud-side">
          <p className="hud-floor-name av-title" title="Planta que estás mirando">
            {floorName(p.config.names, Math.min(level, basements.length))}
          </p>
          <Link href={under(path, "/skins") ? "/" : "/skins"} className="hud-skins" title="Skins: raza de cada agente, estilo de los sótanos y nombres de las plantas" aria-current={under(path, "/skins") ? "page" : undefined}>
            <HudIcon name="skins" size={26} />
          </Link>
          <div className="hud-levels" role="group" aria-label="Plantas">
            <button type="button" aria-pressed={level === 0} onClick={() => setLevel(0)} title={`${floorName(p.config.names, 0)}: planta baja y entrepiso`}>
              {floorShort(p.config.names, 0)}
            </button>
            {basements.map((_, i) => (
              <button key={i} type="button" aria-pressed={level === i + 1} onClick={() => setLevel(i + 1)} title={`${floorName(p.config.names, i + 1)}: ${BASEMENT_VARIANTS.find((v) => v.id === basements[i])?.name}`}>
                {floorShort(p.config.names, i + 1)}
              </button>
            ))}
            <button type="button" aria-expanded={open === "levels"} onClick={() => setOpen(open === "levels" ? "" : "levels")} title="Agregar o sacar un sótano de oficina">
              +S
            </button>
          </div>
          <div className="hud-view" role="group" aria-label="Vista de la casa">
            {VIEW_BUTTONS.map((b) => (
              <button key={b.id} type="button" title={b.title} aria-label={b.title} onClick={() => viewAction(b.id)}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
        {open === "levels" && (
          <FloatWindow id="levels" className="hud-pop hud-basements" role="dialog" label="Sótanos" as="div" min={{ w: 300, h: 180 }} initial={(_vw, vh) => ({ x: 96, y: Math.max(104, vh - 700), w: 380 })}>
            <PopHead title="Sótanos de oficina" onClose={() => setOpen("")} />
            <p className="hud-muted">Cada sótano suma 10 escritorios, debajo del último. Después mudás a quien quieras desde su ficha.</p>
            {basements.length < MAX_BASEMENTS ? (
              BASEMENT_VARIANTS.map((v) => (
                <button key={v.id} type="button" className="hud-variant" disabled={busy} onClick={() => act(() => addBasement(v.id).then(() => (setLevel(basements.length + 1), setOpen(""))))}>
                  <span className="hud-swatch">
                    {v.swatch.map((c) => (
                      <i key={c} style={{ background: c }} />
                    ))}
                  </span>
                  <span>
                    <b>{v.name}</b>
                    <small>{v.idea}</small>
                  </span>
                </button>
              ))
            ) : (
              <p>Ya hay {MAX_BASEMENTS} sótanos: es el máximo por ahora.</p>
            )}
            {basements.length > 0 && (
              <div className="hud-delete">
                <h4 className="av-title">Borrar un sótano</h4>
                {basements.map((v, i) => {
                  const lvl = i + 1;
                  const used = p.agents.some((a) => a.desk.level === lvl);
                  return (
                    <p key={lvl}>
                      <span>
                        S{lvl} · {BASEMENT_VARIANTS.find((x) => x.id === v)?.name}
                      </span>
                      <button type="button" className="hud-chip" disabled={used} title={used ? "Hay agentes trabajando ahí: mudalos primero" : undefined} onClick={() => setDeleting(deleting === lvl ? 0 : lvl)}>
                        {used ? "tiene agentes" : "Borrar"}
                      </button>
                    </p>
                  );
                })}
                {deleting > 0 && (
                  <form
                    className="hud-confirm"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const pw = String(new FormData(e.currentTarget).get("password") ?? "");
                      act(() => deleteBasement(deleting, pw).then(() => (setDeleting(0), setLevel(0), setOpen(""))));
                    }}
                  >
                    <label>
                      Contraseña del panel para borrar el S{deleting}
                      <input name="password" type="password" autoComplete="current-password" required autoFocus />
                    </label>
                    <button className="av-btn text-sm" disabled={busy}>
                      Borrar
                    </button>
                  </form>
                )}
              </div>
            )}
          </FloatWindow>
        )}
        {error && (
          <p className="hud-error" role="alert" onClick={() => setError("")}>
            {error}
          </p>
        )}
        {placing && (
          <p className="hud-hint">
            Elegí el escritorio nuevo de {p.agents.find((a) => a.id === placing)?.name}: tocá un cartel «Acá».{" "}
            <button type="button" className="hud-link" onClick={() => setPlacing(null)}>
              Cancelar
            </button>
          </p>
        )}

        {/* Las pantallas de siempre, como ventana flotante: la casa sigue atrás. */}
        {windowOpen && (
          <>
            <Link href="/" className="hud-veil" aria-label="Cerrar la ventana" tabIndex={-1} />
            <FloatWindow
              id={`win:${section?.id ?? "otra"}`}
              className="hud-win"
              role="dialog"
              label={section?.label ?? "Agent Village"}
              min={{ w: 460, h: 280 }}
              initial={(vw, vh) => {
                const w = Math.min(section?.wide || under(path, "/demos/") ? 1480 : 1180, vw - 150);
                return { x: (vw - w) / 2, y: 104, w, h: vh - 104 - 110 };
              }}
            >
              <header className="hud-win-head" data-drag title="Arrastrá para mover · doble clic para volver a su lugar">
                <HudIcon name={section?.id ?? "gear"} size={26} />
                <h2 className="av-title">{section?.label ?? "Agent Village"}</h2>
                {section && section.tabs.length > 1 && (
                  <nav className="hud-tabs">
                    {section.tabs
                      .filter(([href]) => href !== "/negocios" || under(path, "/negocios"))
                      .map(([href, label]) => (
                        <Link key={href} href={href === "/negocios" ? path : href} aria-current={under(path, href) ? "page" : undefined}>
                          {label}
                        </Link>
                      ))}
                  </nav>
                )}
                <Link href="/" className="hud-close" aria-label="Cerrar" title="Cerrar (Esc)">
                  ×
                </Link>
              </header>
              <div className="hud-win-body">{p.children}</div>
            </FloatWindow>
          </>
        )}

        {agent && (
          <AgentPanel
            agent={agent}
            inventory={p.inventory}
            freeDesks={p.freeDesks}
            placing={placing === agent.id}
            busy={busy}
            onPlace={() => (setPlacing(placing ? null : agent.id), setLevel(0))}
            onMove={(deskId) => act(() => moveAgent(agent.id, deskId).then(() => setPlacing(null)))}
            onFocus={() => goToAgent(agent)}
            onClose={() => (setPicked(null), setPlacing(null))}
          />
        )}
      </div>
    </GameContext.Provider>
  );
}

/** Barra de energía en 10 bloques. null = todavía no hubo lecturas de la cuota. */
function Energy({ level }: { level: number | null }) {
  const full = level == null ? 0 : Math.round(level / 10);
  const tone = level == null ? "var(--av-idle)" : level <= 20 ? "var(--av-stuck)" : level <= 50 ? "var(--av-wait)" : "var(--av-work)";
  return (
    <div className="hud-energy" title="Energía: lo que queda de la cuota de Claude (la ventana más gastada)" role="meter" aria-label="Energía" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level ?? undefined}>
      <HudIcon name="bolt" size={20} />
      <span className="hud-blocks">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ background: i < full ? tone : undefined }} />
        ))}
      </span>
      <b>{level == null ? "s/d" : `${level}%`}</b>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => (clearTimeout(first), clearInterval(t));
  }, []);
  return (
    <div className="hud-clock" suppressHydrationWarning>
      <b>{now ? now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"}</b>
      <small>{now ? now.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }) : ""}</small>
    </div>
  );
}

const STAGE: Record<string, string> = { found: "Encontrado", analyzed: "Analizado", demo_created: "Con demo", contacted: "Contactado", replied: "Le interesó", closed: "Cliente", paying: "Cliente", hosted: "Cliente", lost: "Perdido", do_not_contact: "No contactar" };

/** Buscador de negocios por nombre: abre la ficha. */
function Search({ close }: { close: () => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) return;
    let live = true;
    const t = setTimeout(() => searchBusinesses(q).then((r) => live && setFound(r)), 220);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  const list = q.trim().length < 2 ? null : found;
  return (
    <FloatWindow id="search" className="hud-pop hud-search" role="dialog" label="Buscar un negocio" as="div" min={{ w: 280, h: 140 }} initial={(vw) => ({ x: vw - 400, y: 104, w: 380 })}>
      <PopHead title="Buscar un negocio" onClose={close} />
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del negocio…" aria-label="Nombre del negocio" />
      {list?.length === 0 && <p className="hud-muted">No hay negocios con ese nombre.</p>}
      {list?.map((l) => (
        <Link key={l.id} href={`/negocios/${l.id}`} className="hud-notice" onClick={close}>
          <span>
            <b>{l.name}</b>
            <small>{l.address ?? "sin dirección"}</small>
          </span>
          <em>{STAGE[l.stage] ?? l.stage}</em>
        </Link>
      ))}
      <Link href="/buscar" className="hud-link" onClick={close}>
        Buscar negocios nuevos en el mapa
      </Link>
    </FloatWindow>
  );
}

/** Barra de arriba de los desplegables: se agarra para moverlos. */
function PopHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <header className="hud-pop-head" data-drag title="Arrastrá para mover · doble clic para volver a su lugar">
      <h3 className="av-title">{title}</h3>
      <button type="button" className="hud-x" onClick={onClose} aria-label="Cerrar">
        ×
      </button>
    </header>
  );
}
