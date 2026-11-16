import type { DemoCopy } from "./content";

export const MAX_PHOTOS = 6;
export const MAX_UPLOAD_BYTES = 10_000_000;

/** Arma los textos de la demo desde el formulario de edición. Servicios: una línea "Título | descripción". */
export function copyFromForm(f: { get: (k: string) => unknown }): DemoCopy {
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const lines = (k: string) => s(k).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return {
    headline: s("headline"),
    subheadline: s("subheadline"),
    about: s("about"),
    ctaLabel: s("ctaLabel"),
    highlights: lines("highlights"),
    services: lines("services").map((l) => {
      const [title, ...rest] = l.split("|");
      return { title: title.trim(), description: rest.join("|").trim() };
    }),
  };
}

export function servicesToText(services: DemoCopy["services"]) {
  return services.map((x) => `${x.title} | ${x.description}`).join("\n");
}
