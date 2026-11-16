"use client";

import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { MapLead } from "./leads-map";

// Política de OSM: crédito visible y URL configurable (para pasar a otro proveedor si se comercializa).
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Datos de negocios: Overture Maps';

const color = (score: number) => (score >= 80 ? "#059669" : score >= 60 ? "#d97706" : "#78716c");

export default function LeadsMapInner({ center, radiusKm, leads }: { center: [number, number]; radiusKm: number; leads: MapLead[] }) {
  return (
    <MapContainer center={center} zoom={radiusKm > 5 ? 12 : 14} scrollWheelZoom className="av-panel h-96 w-full">
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
      <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: "#57534e", weight: 1, fillOpacity: 0.04 }} />
      {leads.map((l) => (
        <CircleMarker key={l.id} center={[l.lat, l.lng]} radius={6} pathOptions={{ color: "#fff", weight: 1, fillColor: color(l.score), fillOpacity: 0.9 }}>
          <Popup>
            <strong>{l.name}</strong>
            <br />
            Puntaje {l.score} · {l.webLabel}
            <br />
            <a href={l.mapsUrl} target="_blank" rel="noopener noreferrer">
              Ver en Google Maps
            </a>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
