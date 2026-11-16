"use client";

import dynamic from "next/dynamic";

export type MapLead = { id: string; name: string; lat: number; lng: number; score: number; webLabel: string; mapsUrl: string };

// Leaflet usa `window`: se carga solo en el navegador.
const Inner = dynamic(() => import("./leads-map-inner"), {
  ssr: false,
  loading: () => <div className="h-96 w-full animate-pulse rounded-xl bg-stone-100" aria-label="Cargando mapa" />,
});

export function LeadsMap(props: { center: [number, number]; radiusKm: number; leads: MapLead[] }) {
  return <Inner {...props} />;
}
