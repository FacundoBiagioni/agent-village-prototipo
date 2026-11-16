"use client";

import { useEffect } from "react";

const RELOADED = "av-sw-cleared";

/** El panel no usa service worker (solo el Modo Visita del celular). Si quedó uno que controla esta pestaña,
 *  se da de baja y se recarga una vez: así nunca se arma el panel con código viejo guardado (pasó el 2026-11-05).
 *  visita.html lo vuelve a registrar cuando se abre; las visitas sin subir están en localStorage y no se tocan. */
export function NoServiceWorker() {
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    void (async () => {
      const regs = await sw.getRegistrations();
      if (regs.length === 0) return;
      await Promise.all(regs.map((r) => r.unregister()));
      // Las copias viejas del código del panel (la caché v1 servía archivos de Next sin pedirlos de nuevo).
      if ("caches" in window) await caches.delete("visita-v1");
      let reloaded = false;
      try {
        reloaded = sessionStorage.getItem(RELOADED) === "1";
        sessionStorage.setItem(RELOADED, "1");
      } catch {
        // sin sessionStorage: igual se recarga una sola vez porque ya no queda service worker
      }
      if (sw.controller && !reloaded) location.reload();
    })();
  }, []);
  return null;
}
