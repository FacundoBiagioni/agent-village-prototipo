// Arma prototype/db.tar.gz: la base del prototipo con datos 100% inventados (negocios, mensajes, demos, ventas).
// Las plantillas del Diseñador vienen de prototype/source.json: son diseños con huecos ({{nombre}}, {{telefono}}), sin datos de nadie.
// Uso: npm run seed
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as s from "../src/db/schema";

const client = new PGlite();
const db = drizzle({ client, schema: s, casing: "snake_case" });
await migrate(db, { migrationsFolder: "drizzle" });
// Las filas se cargan en cualquier orden (una tarea puede nombrar una plantilla antes de existir): sin chequeo de claves foráneas mientras se arma.
await client.exec("set session_replication_role = replica");

// Azar con semilla: cada `npm run seed` da los mismos datos.
let seed = 20261116;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000);
const slugify = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------- Negocios inventados ----------
const NAMES = {
  dentist: ["Odontología Sonrisa Norte", "Consultorio Dental Plaza Moreno", "Clínica Odontológica Diagonal", "Odontología Integral Los Tilos", "Centro Dental Bosque", "Consultorio Odontológico Calle 8", "Dental Estudio Meridiano", "Odontología Familiar Arroyo", "Sonríe Odontología", "Clínica Dental Puerto Claro", "Odontología Rumbo Sur", "Consultorio Dental Tolosa Centro"],
  beauty: ["Peluquería Tijera de Oro", "Estética Bruma", "Salón Ámbar", "Peluquería Mechas & Co.", "Estudio de Belleza Lirio", "Barbería El Faro Gris", "Barbería Navaja Fina", "Estética Piel Serena", "Peluquería Rizo Libre", "Salón Duna", "Barbería Clásica 1882", "Estudio Uñas y Color", "Peluquería Brisa", "Barbería Corte Diagonal"],
  architecture: ["Estudio Prisma Arquitectura", "Estudio Horizonte Arq.", "Taller Umbral Arquitectos", "Estudio Línea Blanca", "Arquitectura Patio Verde", "Estudio Cota Cero", "Planta Libre Arquitectos", "Estudio Muro y Luz"],
} as const;
const CATEGORY = { dentist: "dentist", beauty: "beauty_salon", architecture: "architectural_designer" } as const;
const CENTER = { lat: -34.9214, lng: -57.9545 };

type Lead = typeof s.leads.$inferInsert;
const leads: Lead[] = [];
const niches = Object.keys(NAMES) as (keyof typeof NAMES)[];
for (let i = 0; i < 150; i++) {
  const niche = pick(niches);
  const base = pick(NAMES[niche]);
  const name = i < 34 ? NAMES[niche][i % NAMES[niche].length] : `${base} ${pick(["II", "Sucursal Centro", "Express", "Studio", "Sede Norte", "City Bell", "Gonnet"])}`;
  const r = rnd() * 0.07, a = rnd() * Math.PI * 2;
  const status = pick(["none", "none", "none", "none", "social_only", "social_only", "unchecked", "ok", "outdated", "outdated", "down"] as const);
  const slug = slugify(name);
  leads.push({
    id: randomUUID(),
    source: "overture",
    sourceId: `prototipo-${i}`,
    name,
    niche,
    category: niche === "beauty" && name.startsWith("Barber") ? "barber" : CATEGORY[niche],
    lat: CENTER.lat + r * Math.sin(a),
    lng: CENTER.lng + r * Math.cos(a) * 1.2,
    address: `Calle ${int(1, 72)} nº ${int(100, 2400)}, La Plata`,
    // 221 000-xxxx: característica real, número que no existe.
    phone: rnd() < 0.75 ? `+5492210${String(int(0, 999999)).padStart(6, "0")}` : null,
    websites: ["ok", "outdated", "down", "unchecked"].includes(status) ? [`https://${slug}.example`] : [],
    socials: status === "social_only" || rnd() < 0.3 ? [`https://www.instagram.com/${slug.replace(/-/g, "")}.prototipo`] : [],
    webStatus: status,
    webScore: status === "outdated" ? int(70, 96) : status === "ok" ? int(8, 35) : null,
    webCheckedAt: ["ok", "outdated", "down"].includes(status) ? ago(int(600, 9000)) : null,
    confidence: 0.6 + rnd() * 0.38,
    sourcesCount: int(1, 4),
    stage: "found",
    seenInRelease: "2026-10-15.0",
    createdAt: ago(int(3000, 20000)),
    updatedAt: ago(int(60, 3000)),
  });
}
// Avanzar algunos en el embudo (sin web: los que más interesan).
const noWeb = leads.filter((l) => l.webStatus === "none" || l.webStatus === "social_only");
const byStage = (stage: Lead["stage"], n: number) => noWeb.filter((l) => l.stage === "found").slice(0, n).map((l) => ((l.stage = stage), l));
const analyzed = byStage("analyzed", 9);
const demoCreated = byStage("demo_created", 4);
const contacted = byStage("contacted", 3);
const replied = byStage("replied", 2);
const paying = byStage("paying", 1);
const lost = byStage("lost", 2).map((l) => ((l.lostReason = "Ya tiene quien le haga la web"), l));
const dnc = byStage("do_not_contact", 1);
for (const l of [...demoCreated, ...contacted, ...replied, ...paying]) if (!l.phone) l.phone = `+5492210${String(int(0, 999999)).padStart(6, "0")}`;
await db.insert(s.leads).values(leads);

// ---------- Plantillas del Diseñador (diseños con huecos) ----------
const source = JSON.parse(readFileSync("prototype/source.json", "utf8")) as {
  templates: { niche: string; aesthetic: string; format: string; features: string[]; fonts: string | null; css: string; pages: Record<string, string>; status: "pending" | "approved" | "discarded"; note: string | null }[];
  settings: Record<string, unknown>;
};
const runs: (typeof s.agentRuns.$inferInsert)[] = [];
const events: (typeof s.agentEvents.$inferInsert)[] = [];
const claudeUsage = (cost: number, quota: number) => ({ input_tokens: int(8000, 40000), output_tokens: int(6000, 30000), estimatedCostUsd: cost, quotaPct5h: quota });

function run(agentId: string, taskType: string, brain: "code" | "local" | "claude", model: string | null, minAgo: number, status: typeof s.runStatusEnum.enumValues[number], input: object, output: object | null, steps: string[], usage: object | null = null) {
  const id = randomUUID();
  const dur = int(20, 600) * 1000;
  const started = ago(minAgo);
  const finished = ["done", "failed", "rejected"].includes(status) ? new Date(started.getTime() + dur) : null;
  const working = status === "working";
  const stepIndex = working ? Math.max(1, steps.length - 2) : status === "queued" ? 0 : steps.length;
  runs.push({ id, agentId, taskType, brain, model, status, input, output, usage, stepIndex, stepsTotal: steps.length, stepLabel: working ? steps[stepIndex - 1] : status === "queued" ? null : steps.at(-1), createdAt: ago(minAgo + 1), startedAt: status === "queued" ? null : started, finishedAt: finished, durationMs: finished ? dur : null });
  events.push({ runId: id, agentId, type: "queued", payload: input, createdAt: ago(minAgo + 1) });
  if (status !== "queued") {
    events.push({ runId: id, agentId, type: "working", payload: {}, createdAt: started });
    steps.slice(0, stepIndex).forEach((label, i) => events.push({ runId: id, agentId, type: "progress", payload: { label, stepIndex: i + 1, stepsTotal: steps.length }, createdAt: new Date(started.getTime() + (i + 1) * (dur / (steps.length + 1))) }));
  }
  if (finished) events.push({ runId: id, agentId, type: status, payload: status === "failed" ? { error: "La página del negocio no respondió (tiempo agotado)" } : {}, createdAt: finished });
  return id;
}

const templateIds: Record<string, string> = {};
for (const [i, t] of source.templates.entries()) {
  const minAgo = 14000 - i * 1200;
  const id = randomUUID();
  const runId = run("disenador", "crear_plantilla", "claude", "claude-opus-5-5", minAgo, "done", { niche: t.niche, format: t.format, features: t.features, aesthetic: t.aesthetic, note: "" }, { kb: Math.round(JSON.stringify(t.pages).length / 1024), rubro: t.niche, paginas: Object.keys(t.pages), estetica: t.aesthetic, templateId: id }, ["Leyendo las fichas del rubro", "Diseñando la estructura", "Escribiendo el HTML y el CSS", "Revisando contraste y huecos"], claudeUsage(0.4 + rnd() * 0.5, int(8, 15)));
  await db.insert(s.templates).values({ id, niche: t.niche, aesthetic: t.aesthetic, format: t.format, features: t.features, fonts: t.fonts, css: t.css, pages: t.pages, status: t.status, note: null, runId, createdAt: ago(minAgo - 10), decidedAt: t.status === "pending" ? null : ago(minAgo - 60) });
  if (t.status === "approved") templateIds[t.niche] ??= id;
}

// ---------- Demos ----------
const COPY = {
  dentist: { headline: "Tu sonrisa, en buenas manos", subheadline: "Odontología general y estética con turnos en el día, en el corazón de La Plata.", about: "Somos un consultorio pensado para que ir al dentista deje de ser un trámite. Atendemos a toda la familia con tecnología actual y tiempos claros.", services: [{ title: "Limpieza y control", description: "Controles periódicos para prevenir antes que curar." }, { title: "Ortodoncia", description: "Brackets y alineadores para todas las edades." }, { title: "Blanqueamiento", description: "Tratamiento profesional y seguro en consultorio." }], highlights: ["Turnos en el día", "Obras sociales", "Atención a toda la familia"], ctaLabel: "Pedí tu turno" },
  beauty: { headline: "Tu estilo, a tu manera", subheadline: "Cortes, color y peinados con un equipo que te escucha.", about: "Un salón cálido donde cada visita es un rato para vos. Trabajamos con productos profesionales y te asesoramos según tu pelo y tu estilo.", services: [{ title: "Corte y peinado", description: "Cortes actuales pensados para tu tipo de pelo." }, { title: "Color y mechas", description: "Balayage, reflejos y coloración completa." }, { title: "Tratamientos", description: "Nutrición e hidratación profunda." }], highlights: ["Productos profesionales", "Turnos online", "Asesoramiento personalizado"], ctaLabel: "Reservá tu turno" },
  architecture: { headline: "Espacios que se viven", subheadline: "Proyecto y dirección de obra para casas y locales en La Plata y alrededores.", about: "Diseñamos cada proyecto desde cómo lo vas a habitar: la luz, los recorridos y los materiales. Te acompañamos desde la primera idea hasta la entrega.", services: [{ title: "Proyecto", description: "Anteproyecto, planos y documentación para obra." }, { title: "Dirección de obra", description: "Seguimiento y coordinación de la construcción." }, { title: "Reformas", description: "Ampliaciones y remodelaciones integrales." }], highlights: ["Primera reunión sin cargo", "Renders 3D", "Gestión de permisos"], ctaLabel: "Contanos tu proyecto" },
} as const;
const PALETTE = { dentist: { primary: "#1f4e5f", accent: "#3fb8af", soft: "#eef7f6" }, beauty: { primary: "#4a2c3a", accent: "#d98c6b", soft: "#fbf1ec" }, architecture: { primary: "#1d1d1b", accent: "#b08d57", soft: "#f4f1ea" } } as const;
const DIRECTION = { dentist: "editorial", beauty: "photo", architecture: "grotesk" } as const;

const demoOf: Record<string, string> = {};
const slugOf: Record<string, string> = {};
for (const [i, l] of [...demoCreated, ...contacted, ...replied, ...paying].entries()) {
  const niche = l.niche as keyof typeof COPY;
  const digits = l.phone!.replace(/\D/g, "");
  const id = randomUUID();
  const slug = `proto${String(i).padStart(2, "0")}${slugify(l.name).replace(/-/g, "").slice(0, 3)}`.slice(0, 10).padEnd(10, "0");
  const templateId = templateIds[niche === "beauty" && l.name.startsWith("Barber") ? "barber" : niche] ?? templateIds[niche];
  const content = {
    ...COPY[niche],
    palette: PALETTE[niche],
    business: { name: l.name, phone: l.phone, whatsappUrl: `https://wa.me/${digits}`, callUrl: `tel:+${digits}`, address: l.address, mapsUrl: `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}` },
    ...(templateId ? { design: "galeria", templateId } : {}),
  };
  const minAgo = 6000 - i * 700;
  const status = l.stage === "demo_created" ? (i % 2 ? "approved" : "draft") : "published";
  const prep = run("analista", "preparar_demo", "local", "gemma4:12b", minAgo + 40, "done", { leadId: l.id, background: i % 2 === 0 }, { url: `/demo/${slug}`, slug, demoId: id, photos: 0, siteRead: false, instagram: null, usedDraft: false, brandColor: null, designerRun: "", instagramError: null, instagramPhotos: 0 }, ["Leyendo la ficha del negocio", "Buscando su web y redes", "Escribiendo los textos", "Pidiéndole el diseño al Diseñador"], [{ brain: "local", model: "gemma4:12b", usage: { durationMs: int(40000, 160000), inputTokens: int(2000, 6000), outputTokens: int(500, 1400) } }]);
  run("disenador", "armar_demo", "code", null, minAgo + 20, "done", { from: prep, demoId: id }, { url: `/demo/${slug}`, slug, fonts: "", demoId: id, palette: null, direction: DIRECTION[niche] }, ["Eligiendo la plantilla", "Rellenando los huecos", "Guardando la demo"]);
  await db.insert(s.demos).values({ id, leadId: l.id!, slug, template: DIRECTION[niche], content, status, runId: prep, expiresAt: new Date(now + 14 * 86_400_000), createdAt: ago(minAgo), updatedAt: ago(minAgo - 30) });
  demoOf[l.id!] = id;
  slugOf[l.id!] = slug;
}

// ---------- Mensajes y aprobaciones ----------
const approvals: (typeof s.approvals.$inferInsert)[] = [];
const msgText = (name: string, slug: string) => `¡Hola! ¿Cómo están? Les escribo porque vi que ${name} todavía no tiene página web, así que les armé una de muestra para que vean cómo podría quedar: https://agent-village-prototipo.vercel.app/demo/${slug}\n\nSi les gusta, la dejamos lista con sus fotos y datos. Cualquier cosa me escriben por acá.`;
for (const [i, l] of [...contacted, ...replied, ...paying].entries()) {
  const runId = run("comunicador", "redactar_mensaje", "claude", "claude-sonnet-5-5", 4000 - i * 500, "done", { leadId: l.id }, { result: { listoParaEnviar: true }, payload: { aviso: null, mensaje: msgText(l.name, slugOf[l.id!]), negocio: l.name, whatsapp: l.phone, messageId: "" } }, ["Leyendo la demo", "Redactando el mensaje", "Revisando el tono"], claudeUsage(0.05, 2));
  await db.insert(s.messages).values({ leadId: l.id!, demoId: demoOf[l.id!], runId, phone: l.phone!.replace(/\D/g, ""), text: msgText(l.name, slugOf[l.id!]), status: "sent", createdAt: ago(3990 - i * 500), approvedAt: ago(3980 - i * 500), sentAt: ago(3900 - i * 500), repliedAt: l.stage === "contacted" ? null : ago(3000 - i * 500) });
  approvals.push({ runId, agentId: "comunicador", actionType: "whatsapp_message", payload: { aviso: null, mensaje: msgText(l.name, slugOf[l.id!]), negocio: l.name, whatsapp: l.phone, messageId: "" }, status: "approved", createdAt: ago(3990 - i * 500), decidedAt: ago(3980 - i * 500) });
}
// Pendientes en la bandeja: un mensaje y una publicación esperando tu clic.
{
  const l = demoCreated[1];
  const id = randomUUID();
  const payload = { aviso: "Es la primera vez que le escribimos a este negocio.", mensaje: msgText(l.name, slugOf[l.id!]), negocio: l.name, whatsapp: l.phone, messageId: id };
  const runId = run("comunicador", "redactar_mensaje", "claude", "claude-sonnet-5-5", 35, "waiting_approval", { leadId: l.id }, { result: { listoParaEnviar: true }, payload }, ["Leyendo la demo", "Redactando el mensaje", "Revisando el tono"], claudeUsage(0.05, 3));
  await db.insert(s.messages).values({ id, leadId: l.id!, demoId: demoOf[l.id!], runId, phone: l.phone!.replace(/\D/g, ""), text: payload.mensaje, status: "pending_approval", createdAt: ago(30) });
  approvals.push({ runId, agentId: "comunicador", actionType: "whatsapp_message", payload, status: "pending", createdAt: ago(30) });
  events.push({ runId, agentId: "comunicador", type: "waiting_approval", payload: { actionType: "whatsapp_message", approvalId: "" }, createdAt: ago(30) });
}
{
  const l = demoCreated[3];
  const payload = { slug: slugOf[l.id!], demoId: demoOf[l.id!], negocio: l.name, quedaEn: `https://agent-village-prototipo.vercel.app/demo/${slugOf[l.id!]}` };
  const runId = run("analista", "publicar_demo", "code", null, 12, "waiting_approval", { demoId: demoOf[l.id!] }, { result: null, payload }, ["Revisando la demo", "Preparando la publicación"]);
  approvals.push({ runId, agentId: "analista", actionType: "publish_demo", payload, status: "pending", createdAt: ago(10) });
}
await db.insert(s.agentRuns).values(runs.splice(0));

// ---------- Trabajo en curso y rutina ----------
run("analista", "preparar_demo", "local", "gemma4:12b", 3, "working", { leadId: analyzed[0].id, background: true }, null, ["Leyendo la ficha del negocio", "Buscando su web y redes", "Escribiendo los textos", "Pidiéndole el diseño al Diseñador"]);
run("analista", "preparar_demo", "local", "gemma4:12b", 1, "queued", { leadId: analyzed[1].id, background: true }, null, ["Leyendo la ficha del negocio", "Buscando su web y redes", "Escribiendo los textos", "Pidiéndole el diseño al Diseñador"]);
run("analista", "preparar_demo", "local", "gemma4:12b", 900, "failed", { leadId: analyzed[2].id, background: true }, null, ["Leyendo la ficha del negocio", "Buscando su web y redes"]);
for (const m of [5000, 2600, 400]) run("encargado", "supervisar", "code", null, m, "done", {}, { stuck: 0, alerted: 0, retried: m === 2600 ? 1 : 0 }, ["Revisando tareas trabadas", "Revisando la cuota"]);
await db.insert(s.agentRuns).values(runs);
await db.insert(s.approvals).values(approvals);
await db.insert(s.agentEvents).values(events);
events.length = 0;
await db.insert(s.agentEvents).values([
  { agentId: "encargado", type: "web_check", payload: { ok: 14, down: 6, checked: 61, outdated: 19, socialOnly: 22 }, createdAt: ago(7000) },
  { agentId: "encargado", type: "background_report", payload: { done: 6, quota: { fiveHour: null, sevenDay: [41, 52] }, failed: 1, reason: "done", minutes: 47, waiting: 2, failures: ["Preparar demo: la página del negocio no respondió"], leftSaved: 0 }, createdAt: ago(800) },
]);

// ---------- Venta, visitas, no contactar, búsquedas ----------
{
  const l = paying[0];
  const clientId = randomUUID();
  await db.insert(s.clients).values({ id: clientId, leadId: l.id!, packageId: "landing_turnos", priceUsd: 200, maintenanceUsd: 20, domain: `${slugify(l.name)}.example`, siteProject: `prototipo-${slugify(l.name)}`, siteUrl: `https://prototipo-${slugify(l.name)}.vercel.app`, siteStatus: "online", createdAt: ago(2500) });
  await db.insert(s.payments).values([
    { clientId, concept: "Anticipo 50 %", amountUsd: 100, status: "paid", dueDate: ago(2500), paidAt: ago(2400), paidArs: 120000, method: "transferencia", createdAt: ago(2500) },
    { clientId, concept: "Saldo 50 % (al publicar)", amountUsd: 100, status: "paid", paidAt: ago(1200), paidArs: 121000, method: "alias_mp", createdAt: ago(2500) },
    { clientId, concept: "Mantenimiento (ejemplo)", amountUsd: 20, status: "pending", dueDate: new Date(now + 6 * 86_400_000), createdAt: ago(100) },
  ]);
}
await db.insert(s.visits).values([
  { clientId: randomUUID(), leadId: replied[0].id!, demoId: demoOf[replied[0].id!], result: "interested", note: "Le gustó la demo, quiere sumar fotos del local.", visitedAt: ago(1500) },
  { clientId: randomUUID(), leadId: analyzed[3].id!, result: "come_back", note: "Estaba el encargado, volver cuando esté la dueña.", comeBackOn: new Date(now + 3 * 86_400_000).toISOString().slice(0, 10), visitedAt: ago(1300) },
]);
await db.insert(s.doNotContact).values({ leadId: dnc[0].id, name: dnc[0].name, phone: dnc[0].phone?.replace(/\D/g, "") ?? null, reason: "Pidió que no lo contactemos" });
await db.insert(s.searches).values([
  { niche: "dentist", centerLat: CENTER.lat, centerLng: CENTER.lng, radiusKm: 3, results: 41, createdAt: ago(9000) },
  { niche: "beauty", centerLat: CENTER.lat, centerLng: CENTER.lng, radiusKm: 5, results: 63, createdAt: ago(6000) },
  { niche: "architecture", centerLat: -34.88, centerLng: -58.02, radiusKm: 4, results: 18, createdAt: ago(2000) },
]);

// ---------- Ajustes ----------
const settings: Record<string, unknown> = {
  ...source.settings,
  background: { on: false, since: null },
  energy: { at: now, overage: false, fiveHour: { usedPct: 34, resetsAt: now + 2 * 3_600_000 }, rejected: false, sevenDay: { usedPct: 58, resetsAt: now + 3 * 86_400_000 } },
  prototype_seeded_at: new Date(now).toISOString(),
};
await db.insert(s.settings).values(Object.entries(settings).map(([key, value]) => ({ key, value })));

await client.exec("set session_replication_role = origin");
const dump = await client.dumpDataDir("gzip");
writeFileSync("prototype/db.tar.gz", Buffer.from(await dump.arrayBuffer()));
console.log("listo:", leads.length, "negocios,", Object.keys(demoOf).length, "demos,", approvals.filter((a) => a.status === "pending").length, "pendientes en la bandeja");
await client.close();
