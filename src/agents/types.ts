export type Brain = "code" | "local" | "claude";

/** `accept`: control de la tarea sobre la respuesta; si devuelve un motivo, la respuesta de un escalón barato no sirve y se escala. */
export type AskOptions = { schema?: object; system?: string; stage?: string; accept?: (r: AskResult) => string | null };
/** Cerebro más barato para probar antes del de siempre (ruteo, src/brains/routing.ts). */
export type CheaperBrain = { brain: Brain; model?: string };

/** Cerebro de una etapa dentro de una tarea (por ejemplo borrador local y texto final con Claude). */
// web: solo Claude; puede buscar y leer páginas (WebSearch/WebFetch del Agent SDK). Se configura acá, nunca en el prompt.
// cheaper: escalones más baratos, del más barato al más caro; el Encargado los prueba y se quedan si aprueban seguido.
export type BrainConfig = { brain: Brain; model?: string; think?: boolean; fallback?: Brain; fallbackModel?: string; web?: boolean; cheaper?: CheaperBrain[] };
export type AskResult = { text: string; json?: unknown; brain: Brain; model?: string; usage?: Record<string, unknown> };

export type TaskContext = {
  input: Record<string, unknown>;
  /** Contenido de una skill equipada (SKILL.md sin el encabezado). */
  skill: (name: string) => Promise<string>;
  step: (label: string) => Promise<void>;
  /** Pregunta al cerebro configurado para la tarea (con escalado al fallback si falla). */
  ask: (prompt: string, opts?: AskOptions) => Promise<AskResult>;
};

export type TaskConfig = {
  label: string; // nombre visible en la interfaz
  /** Si la tarea necesita un negocio o una demo, desde dónde se pide (no aparece en el selector del Pueblo). */
  startsFrom?: string;
  brain: Brain;
  model?: string; // id de modelo; nunca fijo en el código del cerebro
  fallback?: Brain;
  fallbackModel?: string;
  think?: boolean; // solo modelo local: razonamiento antes de responder
  steps: string[];
  /** Etapas con otro cerebro: ctx.ask(prompt, { stage: "final" }). Sin stage se usa el cerebro de la tarea. */
  stages?: Record<string, BrainConfig>;
  /** Skills equipadas (PLAN 8): nombres de carpeta en .claude/skills/ del repo. */
  equippedSkills?: string[];
  /** Hace el trabajo. Si la tarea sale hacia afuera, devuelve el payload que se manda a la bandeja. */
  run: (ctx: TaskContext) => Promise<unknown>;
  /** Acción hacia afuera. Solo se ejecuta con una aprobación en estado "approved" (runtime/approvals.ts). */
  external?: { actionType: string; execute: (payload: unknown) => Promise<unknown>; onReject?: (payload: unknown) => Promise<void> };
};

export type AgentConfig = {
  id: string;
  name: string;
  role: string;
  tasks: Record<string, TaskConfig>;
  tools: string[];
  /** Lugar en la oficina (PLAN 9.1): escritorio (índice de DESK_SLOTS) y skin de su rubro (SKINS). */
  world: { desk: number; skin: string; /** Recorre los escritorios cuando no tiene nada que hacer. */ patrol?: boolean };
};
