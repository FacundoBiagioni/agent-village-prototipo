"use client";

// Skins: cómo se ve todo. Raza de cada agente, luz y vista pixelada, estilo de cada sótano y nombres de las plantas.
import { useState, useTransition } from "react";
import type { OfficeConfig } from "@/lib/dashboard";
import { COATS, coatFor, SPECIES } from "@/village/office/characters";
import { BACKGROUNDS } from "@/village/office/backgrounds";
import { HOUSE_THEMES } from "@/village/office/house-themes";
import { BASEMENT_VARIANTS, NAME_MAX, SHORT_MAX } from "@/village/office/layout";
import { UI_THEMES } from "@/village/office/ui-themes";
import { setBasementVariant, setOfficeConfig } from "../actions";
import { useGame } from "../game";

const LIGHT: { id: OfficeConfig["light"]; label: string }[] = [
  { id: "auto", label: "Hora real" },
  { id: "day", label: "Siempre de día" },
  { id: "night", label: "Siempre de noche" },
];

export function SkinsPanel({ agents }: { agents: { id: string; name: string }[] }) {
  const { cfg, change } = useGame();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar");
      }
    });
  const cats = cfg.species === "gato";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 lg:col-span-2">
          {error}
        </p>
      )}

      <section className="av-panel p-4 lg:col-span-2">
        <h2 className="mb-1 text-lg">La casa entera</h2>
        <p className="mb-3 text-sm text-(--av-muted)">Cambia pisos, paredes, terreno, árboles, clima y fondo. Los muebles y los agentes quedan igual.</p>
        <Cards items={HOUSE_THEMES} value={cfg.houseTheme} onPick={(id) => change({ houseTheme: id })} />
      </section>

      <section className="av-panel p-4 lg:col-span-2">
        <h2 className="mb-1 text-lg">Fondo</h2>
        <p className="mb-3 text-sm text-(--av-muted)">Lo que se ve detrás de la casa y de los sótanos.</p>
        <Cards items={BACKGROUNDS} value={cfg.background} onPick={(id) => change({ background: id })} />
      </section>

      <section className="av-panel p-4 lg:col-span-2">
        <h2 className="mb-1 text-lg">Interfaz</h2>
        <p className="mb-3 text-sm text-(--av-muted)">Colores de las barras, las ventanas y todas las pantallas. «Juego de oficina» respeta el botón de claro u oscuro.</p>
        <Cards items={UI_THEMES} value={cfg.uiTheme} onPick={(id) => change({ uiTheme: id })} />
      </section>

      <section className="av-panel p-4">
        <h2 className="mb-3 text-lg">Agentes</h2>
        <label className="mb-4 flex flex-col gap-1 text-sm">
          Raza
          <select value={cfg.species} onChange={(e) => change({ species: e.target.value })} className="p-2">
            {SPECIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === "gato" ? "Gatos (cada uno de su raza)" : s.name}
              </option>
            ))}
          </select>
        </label>
        {cats && (
          <ul className="space-y-2">
            {agents.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{a.name}</span>
                <select
                  value={coatFor(a.id, cfg.coats[a.id]).id}
                  disabled={busy}
                  onChange={(e) => run(() => setOfficeConfig({ coats: { [a.id]: e.target.value } }))}
                  className="w-52 p-1.5"
                  aria-label={`Pelaje de ${a.name}`}
                >
                  {COATS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.id === coatFor(a.id).id ? " (el de siempre)" : ""}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="av-panel p-4">
        <h2 className="mb-3 text-lg">Luz y vista</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Luz
            <select value={cfg.light} onChange={(e) => change({ light: e.target.value as OfficeConfig["light"] })} className="p-2">
              {LIGHT.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={cfg.pixel} disabled={cfg.ascii.on} onChange={(e) => change({ pixel: e.target.checked })} /> Vista pixelada
          </label>
        </div>
      </section>

      <section className="av-panel p-4 lg:col-span-2">
        <h2 className="mb-1 text-lg">Plantas</h2>
        <p className="mb-3 text-sm text-(--av-muted)">El nombre aparece abajo a la izquierda y en el cartel de cada sótano; la abreviatura, en su botón (hasta {SHORT_MAX} letras). Vacío: el de siempre.</p>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const get = (k: string) => String(f.get(k) ?? "");
            run(() => setOfficeConfig({ names: { house: get("house"), houseShort: get("houseShort"), basements: cfg.basements.map((_, i) => get(`b${i}`)), basementShorts: cfg.basements.map((_, i) => get(`bs${i}`)) } }));
          }}
        >
          <div className="grid grid-cols-[90px_minmax(0,1fr)_84px_190px] items-center gap-3 text-sm">
            <span />
            <span className="text-xs text-(--av-muted)">Nombre</span>
            <span className="text-xs text-(--av-muted)">Botón</span>
            <span className="text-xs text-(--av-muted)">Estilo</span>
            <span className="font-medium">Casa</span>
            <input name="house" defaultValue={cfg.names.house} maxLength={NAME_MAX} placeholder="La casa" className="p-1.5" />
            <input name="houseShort" defaultValue={cfg.names.houseShort} maxLength={SHORT_MAX} placeholder="Casa" className="p-1.5" aria-label="Abreviatura de la casa" />
            <span className="text-(--av-muted)">ver «La casa entera»</span>
            {cfg.basements.map((variant, i) => (
              <Basement key={i} level={i + 1} variant={variant} name={cfg.names.basements[i] ?? ""} short={cfg.names.basementShorts[i] ?? ""} busy={busy} onVariant={(v) => run(() => setBasementVariant(i + 1, v))} />
            ))}
          </div>
          {cfg.basements.length === 0 && <p className="text-sm text-(--av-muted)">Todavía no hay sótanos: se agregan con «+S», abajo a la izquierda.</p>}
          <button className="av-btn av-btn-coin text-sm" disabled={busy}>
            {busy ? "Guardando…" : "Guardar nombres y botones"}
          </button>
        </form>
      </section>
    </div>
  );
}

function Basement(p: { level: number; variant: string; name: string; short: string; busy: boolean; onVariant: (v: string) => void }) {
  return (
    <>
      <span className="font-medium">Sótano {p.level}</span>
      <input name={`b${p.level - 1}`} defaultValue={p.name} maxLength={NAME_MAX} placeholder={`Sótano ${p.level}`} className="p-1.5" />
      <input name={`bs${p.level - 1}`} defaultValue={p.short} maxLength={SHORT_MAX} placeholder={`S${p.level}`} className="p-1.5" aria-label={`Abreviatura del sótano ${p.level}`} />
      <select value={p.variant} disabled={p.busy} onChange={(e) => p.onVariant(e.target.value)} className="p-1.5" aria-label={`Estilo del sótano ${p.level}`}>
        {BASEMENT_VARIANTS.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </>
  );
}

/** Tarjetas para elegir un tema: muestra de colores, nombre y la idea. */
function Cards({ items, value, onPick }: { items: { id: string; name: string; idea: string; swatch: [string, string, string] }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((t) => (
        <button key={t.id} type="button" onClick={() => onPick(t.id)} aria-pressed={value === t.id} className="skin-card">
          <span className="skin-swatch" aria-hidden>
            {t.swatch.map((c, i) => (
              <i key={i} style={{ background: c }} />
            ))}
          </span>
          <span>
            <b>{t.name}</b>
            <small>{t.idea}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
