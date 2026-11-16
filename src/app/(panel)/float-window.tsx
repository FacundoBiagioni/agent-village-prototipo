"use client";

// Ventana flotante del HUD: se mueve agarrándola de su barra de arriba ([data-drag]) y se agranda o achica desde cualquier esquina.
// Recuerda dónde la dejaste (por navegador). Doble clic en la barra la vuelve a su lugar. En pantallas chicas queda fija.
import { useEffect, useRef, useState } from "react";

export type Box = { x: number; y: number; w: number; h?: number };
const KEY = (id: string) => `hud-float:${id}`;
const TOP = 96; // debajo de la barra de arriba, con aire: la ventana nunca sube más que esto
const NARROW = 760;

/** Mantiene la ventana a la vista: la barra siempre se puede agarrar. */
export function clampBox(b: Box, vw: number, vh: number, min: { w: number; h: number }): Box {
  const w = Math.max(min.w, Math.min(b.w, vw - 16));
  const h = b.h == null ? undefined : Math.max(min.h, Math.min(b.h, vh - TOP - 8));
  return { w, h, x: Math.min(Math.max(b.x, 8 - w + 120), vw - 120), y: Math.min(Math.max(b.y, TOP), vh - 48) };
}

export function FloatWindow(p: {
  id: string;
  className: string;
  initial: (vw: number, vh: number) => Box;
  min: { w: number; h: number };
  children: React.ReactNode;
  role?: string;
  label?: string;
  as?: "section" | "aside" | "div";
}) {
  const { id, initial, min } = p;
  const [box, setBox] = useState<Box | null>(null);
  const [narrow, setNarrow] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Al abrir: el lugar guardado, o el de siempre. Si cambia el tamaño de la pantalla, se reacomoda.
  useEffect(() => {
    const place = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setNarrow(vw < NARROW);
      let saved: Box | null = null;
      try {
        saved = JSON.parse(localStorage.getItem(KEY(id)) ?? "null");
      } catch {
        // sin almacenamiento (ventana privada): se usa el lugar de siempre
      }
      setBox(clampBox(saved && typeof saved.x === "number" ? saved : initial(vw, vh), vw, vh, min));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps -- initial y min son fijos por ventana

  const save = (b: Box) => {
    try {
      localStorage.setItem(KEY(id), JSON.stringify(b));
    } catch {
      // sin almacenamiento: vale solo mientras esté abierta
    }
  };

  /** Arrastre genérico: `apply` recibe cuánto se movió el mouse desde que se apretó. */
  function drag(e: React.PointerEvent, apply: (dx: number, dy: number, start: Box, real: { w: number; h: number }) => Box) {
    if (!box || e.button !== 0) return;
    e.preventDefault();
    const start = box;
    const rect = ref.current!.getBoundingClientRect();
    const real = { w: rect.width, h: rect.height };
    const [sx, sy] = [e.clientX, e.clientY];
    let last = start;
    const move = (ev: PointerEvent) => {
      last = clampBox(apply(ev.clientX - sx, ev.clientY - sy, start, real), window.innerWidth, window.innerHeight, min);
      setBox(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("hud-dragging");
      save(last);
    };
    document.body.classList.add("hud-dragging");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const onHeadDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest("[data-drag]") || t.closest("button, a, input, select, textarea, label")) return;
    drag(e, (dx, dy, s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
  };
  const resize = (corner: string) => (e: React.PointerEvent) =>
    drag(e, (dx, dy, s, real) => {
      const h0 = s.h ?? real.h;
      const left = corner.includes("w");
      const top = corner.includes("n");
      const w = Math.max(min.w, s.w + (left ? -dx : dx));
      const h = Math.max(min.h, h0 + (top ? -dy : dy));
      return { x: left ? s.x + (s.w - w) : s.x, y: top ? s.y + (h0 - h) : s.y, w, h };
    });
  const reset = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest("[data-drag]") || (e.target as HTMLElement).closest("button, a, input")) return;
    const b = clampBox(initial(window.innerWidth, window.innerHeight), window.innerWidth, window.innerHeight, min);
    setBox(b);
    try {
      localStorage.removeItem(KEY(id));
    } catch {
      // nada que borrar
    }
  };

  const Tag = p.as ?? "section";
  // En pantallas chicas (o mientras se calcula el lugar) manda el CSS de siempre.
  const style: React.CSSProperties | undefined =
    narrow || !box ? (box ? undefined : { visibility: "hidden" }) : { left: box.x, top: box.y, width: box.w, height: box.h, right: "auto", bottom: "auto", transform: "none", maxHeight: box.h ? undefined : `calc(100% - ${box.y + 16}px)` };
  return (
    <Tag ref={ref as never} className={`${p.className} hud-float`} style={style} role={p.role} aria-label={p.label} onPointerDown={onHeadDown} onDoubleClick={reset}>
      {p.children}
      {!narrow && box && ["nw", "ne", "sw", "se"].map((c) => <span key={c} className="hud-grip" data-c={c} onPointerDown={resize(c)} aria-hidden />)}
    </Tag>
  );
}
