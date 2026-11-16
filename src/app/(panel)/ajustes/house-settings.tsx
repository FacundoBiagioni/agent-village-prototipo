"use client";

// El botón especial que pasa toda la casa a modo ASCII, con sus opciones. El resto del aspecto está en Skins.
import { ASCII_CELLS, ASCII_CHARSETS, ASCII_TINTS } from "@/village/office/ascii-config";
import { useGame } from "../game";

const field = "flex flex-col gap-1 text-sm";

export function HouseSettings() {
  const { cfg, change } = useGame();
  const a = cfg.ascii;
  return (
    <div className="space-y-4">
      <p className="text-sm text-(--av-muted)">La raza de cada agente, la luz, la vista pixelada, el estilo de los sótanos y los nombres de las plantas se cambian con el botón Skins (abajo a la izquierda).</p>
      <p className="text-xs text-(--av-muted)">Arrastrá para mover la casa, botón derecho para girarla e inclinarla, rueda para acercar. Los botones de abajo a la izquierda hacen lo mismo.</p>

      {/* Botón especial: discreto a propósito. */}
      <div className="flex flex-wrap items-center gap-3 border-t-2 border-dashed border-(--av-sunk) pt-3">
        <button type="button" className="hud-ascii-key" aria-pressed={a.on} onClick={() => change({ ascii: { ...a, on: !a.on } })} title="Modo especial: toda la casa en letras">
          {a.on ? "[ ASCII: on ]" : "[ ASCII ]"}
        </button>
        {a.on && <span className="text-xs text-(--av-muted)">La casa entera en caracteres. Más liviano; algunas cosas visuales se apagan (pixelado, sombras finas).</span>}
      </div>
      {a.on && (
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={field}>
            Caracteres
            <select value={a.charset} onChange={(e) => change({ ascii: { ...a, charset: e.target.value } })} className="p-2 font-mono">
              {ASCII_CHARSETS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}: {c.chars.trim().slice(0, 14)}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            Color
            <select value={a.tint} onChange={(e) => change({ ascii: { ...a, tint: e.target.value } })} className="p-2">
              {ASCII_TINTS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            Tamaño de letra: {a.cell}
            <input type="range" min={0} max={ASCII_CELLS.length - 1} step={1} value={Math.max(0, ASCII_CELLS.indexOf(a.cell))} onChange={(e) => change({ ascii: { ...a, cell: ASCII_CELLS[Number(e.target.value)] } })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={a.edges} onChange={(e) => change({ ascii: { ...a, edges: e.target.checked } })} /> Bordes con rayas ( | / - \ )
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={a.invert} onChange={(e) => change({ ascii: { ...a, invert: e.target.checked } })} /> Invertir (fondo claro)
          </label>
        </div>
      )}
    </div>
  );
}
