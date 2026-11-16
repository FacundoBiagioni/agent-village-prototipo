// Diseños para elegir al pedir una demo (usuario, 2026-11-12: la plantilla la elige él según el perfil de cada cliente, en todos los rubros).
// Valor: "dir:<dirección>" (las 4 de siempre) o "galeria:<id>" (plantilla aprobada de la galería).
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { DIRECTIONS, type DirectionId } from "./directions";
import { AESTHETICS, type AestheticId, type TemplateNiche } from "./gallery";
import { templateNicheOf } from "./gallery-store";

export type DesignChoice = { value: string; label: string; previewUrl: string; multipage: boolean };

export const DESIGN_VALUE = /^(dir:(editorial|grotesk|photo|studio)|galeria:[0-9a-f-]{36})$/;
export const parseDesign = (v: unknown): string | null => (typeof v === "string" && DESIGN_VALUE.test(v) ? v : null);

/** Direcciones que sirven para un rubro: arquitectura usa la de varias páginas; el resto, las de una. */
const dirsFor = (niche: TemplateNiche): DirectionId[] => (niche === "architecture" ? ["studio"] : ["editorial", "grotesk", "photo"]);

/** Opciones por rubro de plantilla (se calculan una vez por rubro, no por negocio). */
export async function designChoicesByNiche(niches: TemplateNiche[]): Promise<Map<TemplateNiche, DesignChoice[]>> {
  const out = new Map<TemplateNiche, DesignChoice[]>();
  for (const n of new Set(niches)) {
    const gallery = await db
      .select({ id: schema.templates.id, aesthetic: schema.templates.aesthetic, format: schema.templates.format })
      .from(schema.templates)
      .where(and(eq(schema.templates.niche, n), eq(schema.templates.status, "approved")))
      .orderBy(asc(schema.templates.createdAt));
    out.set(n, [
      ...dirsFor(n).map((d) => ({ value: `dir:${d}`, label: DIRECTIONS[d].label, previewUrl: `/muestra/${d}?rubro=${n}`, multipage: d === "studio" })),
      ...gallery.map((t, i) => ({
        value: `galeria:${t.id}`,
        label: `Galería ${i + 1}: ${AESTHETICS[t.aesthetic as AestheticId]?.name ?? t.aesthetic}`,
        previewUrl: `/plantillas/${t.id}/vista`,
        multipage: t.format === "multipage",
      })),
    ]);
  }
  return out;
}

export { templateNicheOf };
