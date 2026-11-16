import { bigserial, boolean, date, doublePrecision, index, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const brainEnum = pgEnum("brain", ["code", "local", "claude"]);
// scheduled: guardada para el modo producción (todavía no está en la cola).
export const runStatusEnum = pgEnum("run_status", ["scheduled", "queued", "working", "waiting_approval", "done", "failed", "rejected"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    agentId: text().notNull(),
    taskType: text().notNull(),
    brain: brainEnum().notNull(),
    model: text(),
    status: runStatusEnum().notNull().default("queued"),
    input: jsonb().notNull().default({}),
    output: jsonb(),
    stepIndex: integer().notNull().default(0),
    stepsTotal: integer().notNull().default(0),
    stepLabel: text(),
    usage: jsonb(), // tokens y costo estimado que devuelve el cerebro
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    durationMs: integer(),
  },
  (t) => [index().on(t.agentId, t.taskType, t.brain, t.status)],
);

export const agentEvents = pgTable("agent_events", {
  id: bigserial({ mode: "number" }).primaryKey(),
  runId: uuid().references(() => agentRuns.id),
  agentId: text().notNull(),
  type: text().notNull(),
  payload: jsonb().notNull().default({}),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: uuid().primaryKey().defaultRandom(),
  runId: uuid().notNull().references(() => agentRuns.id),
  agentId: text().notNull(),
  actionType: text().notNull(),
  payload: jsonb().notNull(),
  status: approvalStatusEnum().notNull().default("pending"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp({ withTimezone: true }),
});

// Pipeline del plan (sección 4).
export const leadStageEnum = pgEnum("lead_stage", ["found", "analyzed", "demo_created", "contacted", "replied", "closed", "paying", "hosted", "lost", "do_not_contact"]);
// none: sin web; social_only: solo Instagram/Facebook; unchecked: tiene web, falta revisarla; ok / outdated / down: resultado de la revisión.
export const webStatusEnum = pgEnum("web_status", ["none", "social_only", "unchecked", "ok", "outdated", "down"]);

export const leads = pgTable(
  "leads",
  {
    id: uuid().primaryKey().defaultRandom(),
    source: text().notNull(), // "overture" | "manual"
    sourceId: text(), // id de Overture (GERS); null en los cargados a mano
    name: text().notNull(),
    niche: text(), // dentist | beauty | architecture | null
    category: text(), // categoría original de la fuente
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    address: text(),
    phone: text(),
    websites: text().array().notNull().default([]),
    socials: text().array().notNull().default([]),
    webStatus: webStatusEnum().notNull(),
    webScore: integer(), // 0 = moderna, 100 = muy anticuada
    webSignals: jsonb(),
    webCheckedAt: timestamp({ withTimezone: true }),
    confidence: real(),
    sourcesCount: integer().notNull().default(1),
    stage: leadStageEnum().notNull().default("found"),
    lostReason: text(),
    notes: text(),
    seenInRelease: text(), // última release de Overture donde apareció
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex().on(t.source, t.sourceId), index().on(t.niche, t.lat, t.lng)],
);

// Plantillas que crea el Diseñador (usuario, 2026-11-07): una página (o varias) con huecos que se rellenan con la ficha de cada negocio.
// pending: esperando que el usuario la apruebe en la galería; solo las approved se usan en demos.
export const templateStatusEnum = pgEnum("template_status", ["pending", "approved", "discarded"]);

export const templates = pgTable(
  "templates",
  {
    id: uuid().primaryKey().defaultRandom(),
    niche: text().notNull(), // dentist | beauty | architecture (+ "barber" dentro de beauty)
    aesthetic: text().notNull(), // id de AESTHETICS (src/demos/aesthetics.ts)
    format: text().notNull(), // landing | multipage
    features: jsonb().notNull().default([]), // "turnos", "galeria"
    fonts: text(), // URL de Google Fonts
    css: text().notNull(),
    pages: jsonb().notNull(), // { inicio: "<body>…", servicios: "…" }
    status: templateStatusEnum().notNull().default("pending"),
    note: text(), // pedido del usuario al encargarla o rehacerla
    runId: uuid().references(() => agentRuns.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.niche, t.status)],
);

export const demoStatusEnum = pgEnum("demo_status", ["draft", "approved", "published", "expired", "removed"]);

export const demos = pgTable("demos", {
  id: uuid().primaryKey().defaultRandom(),
  leadId: uuid().notNull().references(() => leads.id),
  slug: text().notNull().unique(), // aleatorio, no adivinable (PLAN 11)
  template: text().notNull(), // dirección de diseño: editorial | grotesk | photo (las viejas guardan el rubro: dentist | beauty)
  content: jsonb().notNull(),
  status: demoStatusEnum().notNull().default("draft"),
  version: integer().notNull().default(1),
  runId: uuid().references(() => agentRuns.id),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// Visitas en persona (Modo Visita, PLAN 10). Se anotan en el celular sin internet y se suben al volver al Wi-Fi.
export const visitResultEnum = pgEnum("visit_result", ["interested", "come_back", "not_interested"]);

export const visits = pgTable(
  "visits",
  {
    id: uuid().primaryKey().defaultRandom(),
    clientId: text().notNull().unique(), // lo genera el celular: si la subida se repite, no se duplica
    leadId: uuid().notNull().references(() => leads.id),
    demoId: uuid().references(() => demos.id),
    result: visitResultEnum().notNull(),
    note: text(),
    comeBackOn: date(), // "volver tal día"
    doNotContact: boolean().notNull().default(false), // "no le interesa" + lo pasás a no contactar
    visitedAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.leadId, t.visitedAt)],
);

// Mensajes a negocios (PLAN 6.3). El envío lo hace el usuario: acá solo se registra.
export const messageStatusEnum = pgEnum("message_status", ["pending_approval", "approved", "sent", "rejected"]);

export const messages = pgTable("messages", {
  id: uuid().primaryKey().defaultRandom(),
  leadId: uuid().notNull().references(() => leads.id),
  demoId: uuid().references(() => demos.id),
  runId: uuid().references(() => agentRuns.id),
  channel: text().notNull().default("whatsapp"),
  phone: text().notNull(), // dígitos, celular argentino
  text: text().notNull(),
  status: messageStatusEnum().notNull().default("pending_approval"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp({ withTimezone: true }),
  sentAt: timestamp({ withTimezone: true }), // lo marca el usuario después de enviarlo
  repliedAt: timestamp({ withTimezone: true }), // "Respondió": queda aunque después el negocio se pierda (métricas)
});

// Ventas y cobros (PLAN 6.4): registro manual. El sistema nunca mueve dinero.
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "cancelled"]);

export const clients = pgTable("clients", {
  id: uuid().primaryKey().defaultRandom(),
  leadId: uuid().notNull().unique().references(() => leads.id),
  packageId: text().notNull(), // ver src/sales/offers.ts
  priceUsd: integer().notNull(),
  maintenanceUsd: integer(), // null = sin mantenimiento
  notes: text(),
  // Hosting (Fase 7): el sitio final vive en Vercel, en la cuenta del usuario. El dominio es del cliente (NIC Argentina, a su nombre).
  domain: text(), // "consultorio.com.ar", sin www
  domainRenewsAt: timestamp({ withTimezone: true }), // vencimiento anual del dominio en NIC
  siteProject: text(), // nombre del proyecto en Vercel
  siteUrl: text(),
  siteStatus: text().notNull().default("none"), // none | online | paused
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid().primaryKey().defaultRandom(),
  clientId: uuid().notNull().references(() => clients.id),
  concept: text().notNull(), // "Anticipo 50 %", "Saldo 50 %", "Mantenimiento 2026-11"
  amountUsd: integer().notNull(), // se cotiza en dólares (PLAN 12)
  status: paymentStatusEnum().notNull().default("pending"),
  dueDate: timestamp({ withTimezone: true }), // null = sin fecha (ej. "al publicar")
  paidAt: timestamp({ withTimezone: true }),
  paidArs: integer(), // pesos recibidos de verdad
  method: text(), // alias_mp | efectivo | transferencia
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const doNotContact = pgTable("do_not_contact", {
  id: uuid().primaryKey().defaultRandom(),
  leadId: uuid().references(() => leads.id),
  name: text(),
  phone: text(), // normalizado a dígitos
  reason: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const searches = pgTable("searches", {
  id: uuid().primaryKey().defaultRandom(),
  niche: text().notNull(),
  centerLat: doublePrecision().notNull(),
  centerLng: doublePrecision().notNull(),
  radiusKm: real().notNull(),
  results: integer().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
});
