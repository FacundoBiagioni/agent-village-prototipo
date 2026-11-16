import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { EnergyReading } from "@/village/energy";

const KEY = "energy";

/** Última lectura de la cuota de Claude (la manda el SDK en cada llamada). */
export async function getEnergy(): Promise<EnergyReading | null> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, KEY));
  return (row?.value as EnergyReading) ?? null;
}

export async function saveEnergy(r: EnergyReading) {
  await db.insert(schema.settings).values({ key: KEY, value: r }).onConflictDoUpdate({ target: schema.settings.key, set: { value: r } });
}
