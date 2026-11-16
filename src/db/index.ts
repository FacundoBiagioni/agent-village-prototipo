// PROTOTIPO: en vez de PostgreSQL, una base en memoria (PGlite) que arranca desde prototype/db.tar.gz,
// una foto con datos inventados que arma `npm run seed`. Nada se guarda: cada arranque vuelve a la foto.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema";

const snapshot = readFileSync(join(process.cwd(), "prototype", "db.tar.gz"));
const client = new PGlite({ loadDataDir: new Blob([snapshot]) });

// Las fechas de la foto se corren al presente, así "hace 2 horas" sigue siendo verdad. PGlite ejecuta en orden,
// así que esto corre antes que cualquier consulta de las páginas.
client.exec(`do $$
declare d interval;
begin
  select now() - (value #>> '{}')::timestamptz into d from settings where key = 'prototype_seeded_at';
  update leads set created_at = created_at + d, updated_at = updated_at + d, web_checked_at = web_checked_at + d;
  update agent_runs set created_at = created_at + d, started_at = started_at + d, finished_at = finished_at + d;
  update agent_events set created_at = created_at + d;
  update approvals set created_at = created_at + d, decided_at = decided_at + d;
  update templates set created_at = created_at + d, decided_at = decided_at + d;
  update demos set created_at = created_at + d, updated_at = updated_at + d, expires_at = expires_at + d;
  update messages set created_at = created_at + d, approved_at = approved_at + d, sent_at = sent_at + d, replied_at = replied_at + d;
  update clients set created_at = created_at + d, domain_renews_at = domain_renews_at + d;
  update payments set created_at = created_at + d, due_date = due_date + d, paid_at = paid_at + d;
  update searches set created_at = created_at + d;
  update visits set visited_at = visited_at + d, created_at = created_at + d, come_back_on = (come_back_on + d)::date;
  update settings set value = jsonb_set(jsonb_set(jsonb_set(value, '{at}', to_jsonb(floor(extract(epoch from now()) * 1000))),
    '{fiveHour,resetsAt}', to_jsonb(floor(extract(epoch from now() + interval '2 hours') * 1000))),
    '{sevenDay,resetsAt}', to_jsonb(floor(extract(epoch from now() + interval '3 days') * 1000))) where key = 'energy';
end $$;`);

export const db = drizzle({ client, schema, casing: "snake_case" });
// El original avisa cambios en vivo con pg_notify; en el prototipo no hay nadie escuchando.
export const pool = { query: async (..._args: unknown[]) => ({ rows: [] as unknown[] }) };
export { schema };
