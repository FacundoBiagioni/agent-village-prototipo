import type { AskResult } from "@/agents/types";

const OLLAMA = process.env.OLLAMA_HOST ?? "http://localhost:11434";

// Ollama directo (no vía Agent SDK): en la Fase 0 el SDK tardó 14 s por una respuesta corta.
export async function askLocal(prompt: string, o: { model: string; schema?: object; think?: boolean; system?: string }): Promise<AskResult> {
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    body: JSON.stringify({
      model: o.model,
      stream: false,
      think: o.think ?? false,
      // Cargar gemma4 en la GPU tarda ~2 min (medido 2026-10-30); se mantiene cargado entre tareas.
      keep_alive: process.env.OLLAMA_KEEP_ALIVE ?? "30m",
      ...(o.schema && { format: o.schema }),
      options: { temperature: 0.2 },
      messages: [...(o.system ? [{ role: "system", content: o.system }] : []), { role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(5 * 60_000),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const text: string = j.message?.content ?? "";
  return {
    text,
    json: o.schema ? JSON.parse(text) : undefined,
    brain: "local",
    model: o.model,
    usage: { inputTokens: j.prompt_eval_count, outputTokens: j.eval_count, durationMs: Math.round(j.total_duration / 1e6) },
  };
}
