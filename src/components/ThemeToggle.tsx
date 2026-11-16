"use client";

import { PixelIcon } from "./pixel-icon";
import { THEME_ATTR, THEME_KEY } from "./theme";

/** Día o noche en la oficina (modo claro u oscuro del panel). El ícono cambia solo con CSS según la marca de <html>. */
export function ThemeToggle() {
  function toggle() {
    const html = document.documentElement;
    const dark = html.getAttribute(THEME_ATTR) !== "dark";
    if (dark) html.setAttribute(THEME_ATTR, "dark");
    else html.removeAttribute(THEME_ATTR);
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      // sin almacenamiento (ventana privada): vale solo para esta visita
    }
  }
  return (
    <button type="button" onClick={toggle} className="av-btn min-h-9 px-2.5" aria-label="Cambiar entre modo claro y oscuro">
      <span className="[[data-panel-theme=dark]_&]:hidden">
        <PixelIcon name="luna" size={18} />
      </span>
      <span className="hidden [[data-panel-theme=dark]_&]:inline">
        <PixelIcon name="sol" size={18} />
      </span>
    </button>
  );
}
