import { displayPhone, type DemoContent } from "../content";
import type { Photo } from "../brand";
import type { Tokens } from "../directions";

/** Los tokens de la dirección como variables CSS (--bg, --ink, ...), para usarlas con Tailwind: bg-(--bg). */
export const tokenVars = (t: Tokens) => Object.fromEntries(Object.entries(t).map(([k, v]) => [`--${k}`, v])) as React.CSSProperties;
export const ACCENT_BUTTON: React.CSSProperties = { background: "var(--accent)", color: "var(--onAccent)" };
// Para la barra fija cuando el hero ya es del color de acento (si no, se pierde encima).
export const INK_BUTTON: React.CSSProperties = { background: "var(--ink)", color: "var(--bg)" };

/** Aviso obligatorio (PLAN 11): discreto pero siempre visible. */
export function DemoNotice({ name, expiresAt }: { name: string; expiresAt: Date }) {
  const until = expiresAt.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  return (
    <p className="bg-neutral-900 px-4 py-1.5 text-center text-xs text-white">
      Propuesta de diseño para {name}. No es el sitio oficial. Disponible hasta el {until}.
    </p>
  );
}

/** Botón principal: WhatsApp si es celular, llamada si es fijo. "consulta" para rubros sin turnos (arquitectura). */
export function ContactButton({ c, className, style, what = "turno" }: { c: DemoContent; className: string; style?: React.CSSProperties; what?: "turno" | "consulta" }) {
  const href = c.business.whatsappUrl ?? c.business.callUrl;
  if (!href) return null;
  return (
    <a href={href} className={className} style={style} target={c.business.whatsappUrl ? "_blank" : undefined} rel="noopener noreferrer">
      {what === "consulta"
        ? c.business.whatsappUrl ? "Consultar por WhatsApp" : "Llamar para consultar"
        : c.business.whatsappUrl ? "Pedir turno por WhatsApp" : "Llamar para pedir turno"}
    </a>
  );
}

/** En el celular, barra fija abajo: turno y, si hay WhatsApp, también un botón de llamada (ficha, sección 3). */
export function StickyContact({ c, style, what }: { c: DemoContent; style: React.CSSProperties; what?: "turno" | "consulta" }) {
  if (!c.business.whatsappUrl && !c.business.callUrl) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2 p-3 sm:hidden">
      <ContactButton c={c} style={style} what={what} className="block flex-1 rounded-full px-5 py-3.5 text-center font-semibold shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2" />
      {c.business.whatsappUrl && c.business.callUrl && (
        <a href={c.business.callUrl} aria-label="Llamar" style={style} className="grid size-13 shrink-0 place-items-center rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </a>
      )}
    </div>
  );
}

/* eslint-disable @next/next/no-img-element -- la demo publicada es HTML estático: no hay servidor para next/image */

/** Foto de fondo del hero, con un velo oscuro para que el texto blanco se lea. */
export function HeroImage({ photo, name, veil = "bg-gradient-to-t from-black/75 via-black/30 to-black/10" }: { photo: Photo; name: string; veil?: string }) {
  return (
    <>
      <img src={photo.src} alt={`Foto de ${name}`} width={photo.w} height={photo.h} fetchPriority="high" className="absolute inset-0 size-full object-cover" />
      <div className={`absolute inset-0 ${veil}`} aria-hidden />
    </>
  );
}

/** Foto en tarjeta. Con tint, un velo del color de marca disimula fotos flojas (Plan B de la ficha). */
export function PhotoCard({ photo, name, className, tint }: { photo: Photo; name: string; className: string; tint?: boolean }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img src={photo.src} alt={`Foto de ${name}`} width={photo.w} height={photo.h} loading="lazy" className="size-full object-cover" />
      {tint && <div className="absolute inset-0 bg-(--accent) opacity-25 mix-blend-multiply" aria-hidden />}
    </div>
  );
}

/** Teléfono a la vista en el encabezado (computadora); en el celular ya está la barra fija. */
export function PhoneLink({ c, className }: { c: DemoContent; className: string }) {
  if (!c.business.phone || !c.business.callUrl) return null;
  // inline-block + py-1: el link queda de 24 px de alto o más, fácil de tocar (control de calidad, 2026-11-10).
  return (
    <a href={c.business.callUrl} className={`inline-block py-1 ${className}`}>
      {displayPhone(c.business.phone)}
    </a>
  );
}

/** Columnas de la grilla de servicios: con 4, de a 2, para que no quede una tarjeta suelta. */
export const serviceCols = (n: number) => (n === 4 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3");

/** Dirección y mapa, fáciles de encontrar (ficha, sección 3). */
export function Visit({ c, className, linkClassName }: { c: DemoContent; className: string; linkClassName?: string }) {
  return (
    <div className={className}>
      <p>{c.business.name}</p>
      {c.business.address && <p>{c.business.address}</p>}
      <a href={c.business.mapsUrl} target="_blank" rel="noopener noreferrer" className={`inline-block py-1.5 ${linkClassName ?? "underline underline-offset-4"}`}>
        Cómo llegar (Google Maps)
      </a>
    </div>
  );
}
