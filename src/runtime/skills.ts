// Skills equipables (PLAN 8): inventario (solo las revisadas en .claude/skills/ del repo) y lo que tiene equipado cada agente.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { approxTokens } from "./skills-rules";

const DIR = join(process.cwd(), ".claude", "skills");
/** El aura: lo que se le equipa a este agente se aplica a todos. */
export const AURA_AGENT = "encargado";

export type Skill = { name: string; description: string; tokens: number };

/** El texto de la skill, sin el encabezado (lo que recibe el modelo). */
export async function skillBody(name: string) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Nombre de skill inválido: ${name}`);
  const md = await readFile(join(DIR, name, "SKILL.md"), "utf8");
  return md.replace(/^---[\s\S]*?---\s*/, "");
}

/** Inventario: las skills del repo, con su descripción y cuánto pesan por pedido. */
export async function listInventory(): Promise<Skill[]> {
  const dirs = await readdir(DIR, { withFileTypes: true }).catch(() => []);
  const out: Skill[] = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const md = await readFile(join(DIR, d.name, "SKILL.md"), "utf8").catch(() => null);
    if (!md) continue;
    const description = md.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
    out.push({ name: d.name, description, tokens: approxTokens(md.replace(/^---[\s\S]*?---\s*/, "")) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Skills equipadas por agente (`settings.equipped_skills`). */
export async function getEquipment(): Promise<Record<string, string[]>> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "equipped_skills"));
  return (row?.value as Record<string, string[]>) ?? {};
}

export async function setEquipment(agentId: string, skills: string[]) {
  const all = { ...(await getEquipment()), [agentId]: skills };
  await db.insert(schema.settings).values({ key: "equipped_skills", value: all }).onConflictDoUpdate({ target: schema.settings.key, set: { value: all } });
}
