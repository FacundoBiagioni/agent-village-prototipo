// Constantes del modo oscuro del panel (fuera del componente cliente: los layouts del servidor las usan como valores).
// La marca va en <html data-panel-theme="dark">; el CSS solo la aplica dentro de #panel, así las demos no cambian.
export const PANEL_ID = "panel";
export const THEME_KEY = "panel-theme";
export const THEME_ATTR = "data-panel-theme";

// Va en el <head> del layout raíz (React no lo vuelve a armar al navegar): aplica el modo antes de pintar.
// Oscuro por defecto (usuario, 2026-11-16): claro solo si se eligió con el botón.
export const THEME_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")!=="light")document.documentElement.setAttribute("${THEME_ATTR}","dark")}catch(e){}`;
