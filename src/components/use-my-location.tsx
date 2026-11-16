"use client";

import { useState } from "react";

/** Completa lat/lng del formulario con la ubicación del navegador (modo "cerca mío"). */
export function UseMyLocation() {
  const [msg, setMsg] = useState<string | null>(null);
  function locate(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.form!;
    if (!navigator.geolocation) return setMsg("Este navegador no da la ubicación");
    setMsg("Buscando tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        (form.elements.namedItem("lat") as HTMLInputElement).value = p.coords.latitude.toFixed(5);
        (form.elements.namedItem("lng") as HTMLInputElement).value = p.coords.longitude.toFixed(5);
        setMsg("Listo: se busca desde donde estás");
      },
      () => setMsg("No se pudo obtener la ubicación; se usa La Plata centro"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={locate} className="av-btn text-sm ">
        Usar mi ubicación
      </button>
      {msg && (
        <span className="text-sm text-stone-500" role="status">
          {msg}
        </span>
      )}
    </div>
  );
}
