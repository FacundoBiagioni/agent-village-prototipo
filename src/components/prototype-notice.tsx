"use client";

import { useEffect, useRef, useState } from "react";

const REPO = "https://github.com/FacundoBiagioni/agent-village-prototipo";

/** PROTOTIPO: cartel fijo de "esto es una muestra" y un aviso cada vez que se toca algo que en el original haría una acción. */
export function PrototypeNotice() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // Cada formulario del panel dispara una acción del servidor, que en el prototipo no hace nada: se avisa.
    const onSubmit = () => {
      setToast(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(false), 3200);
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  return (
    <>
      <div style={bar} role="note">
        <span style={dot} aria-hidden />
        <strong style={{ letterSpacing: ".06em" }}>PROTOTIPO DE MUESTRA</strong>
        <button type="button" style={more} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Cerrar" : "¿Qué es esto?"}
        </button>
      </div>
      {open && (
        <div style={panel} role="dialog" aria-label="Sobre este prototipo">
          <p style={{ margin: 0 }}>
            Es una copia de muestra de <b>Agent Village</b>, un equipo de agentes de IA que encuentra negocios sin web, les arma una demo y prepara el mensaje, y nunca hace nada hacia afuera sin aprobación.
          </p>
          <p style={{ margin: "10px 0 0" }}>La interfaz es la misma que la del original, pero los negocios y los datos son inventados y los botones no hacen nada a propósito. El original corre en una computadora personal, con sus propios agentes.</p>
          <a href={REPO} target="_blank" rel="noopener" style={link}>
            Ver el código del prototipo ↗
          </a>
        </div>
      )}
      <div style={{ ...toastBox, opacity: toast ? 1 : 0, transform: `translate(-50%, ${toast ? 0 : 12}px)` }} role="status" aria-live="polite">
        {toast ? "Prototipo de muestra: esta acción está desactivada." : ""}
      </div>
    </>
  );
}

const font = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const bar: React.CSSProperties = { position: "fixed", bottom: 16, right: 16, zIndex: 2147483000, display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 6px 12px", borderRadius: 999, background: "#161616", color: "#fff", border: "1px solid rgba(255,255,255,.18)", boxShadow: "0 6px 24px rgba(0,0,0,.35)", font: `600 11px/1 ${font}`, whiteSpace: "nowrap" };
const dot: React.CSSProperties = { width: 8, height: 8, borderRadius: "50%", background: "#ff6436" };
const more: React.CSSProperties = { font: `500 11px/1 ${font}`, color: "#161616", background: "#fff", border: 0, borderRadius: 999, padding: "6px 10px", cursor: "pointer" };
const panel: React.CSSProperties = { position: "fixed", bottom: 60, right: 16, zIndex: 2147483000, width: "min(420px, calc(100vw - 24px))", padding: 16, borderRadius: 12, background: "#161616", color: "#f1f1f1", border: "1px solid rgba(255,255,255,.18)", boxShadow: "0 12px 40px rgba(0,0,0,.45)", font: "14px/1.45 system-ui, sans-serif" };
const link: React.CSSProperties = { display: "inline-block", marginTop: 12, color: "#ff6436", font: `600 12px/1 ${font}` };
const toastBox: React.CSSProperties = { position: "fixed", bottom: 112, left: "50%", zIndex: 2147483000, padding: "10px 16px", borderRadius: 10, background: "#ff6436", color: "#161616", font: `600 13px/1.3 ${font}`, boxShadow: "0 8px 30px rgba(0,0,0,.35)", transition: "opacity .25s, transform .25s", pointerEvents: "none" };
