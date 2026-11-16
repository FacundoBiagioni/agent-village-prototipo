import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AskResult } from "@/agents/types";
import { getEnergy, saveEnergy } from "@/runtime/energy";
import { quotaSpend } from "@/runtime/supervisor-rules";
import { parseRateLimit } from "@/village/energy";

// Usa la sesión del plan Pro (login de Claude Code): consume cuota, no API paga.
// Con `web`: solo búsqueda y lectura de páginas (nada de comandos ni archivos), autorizadas sin preguntar porque el worker corre solo.
// Verificado en los tipos del SDK instalado (0.3.314): `tools` limita lo disponible y `allowedTools` lo autoriza.
const WEB_TOOLS = ["WebSearch", "WebFetch"];
const WEB_MAX_TURNS = 16; // cada búsqueda o lectura es un turno; tope para que no se coma la cuota

export async function askClaude(prompt: string, o: { model: string; schema?: object; system?: string; web?: boolean }): Promise<AskResult> {
  const fullPrompt = o.schema ? `${prompt}\n\nRespondé solo con JSON válido que cumpla este esquema: ${JSON.stringify(o.schema)}` : prompt;
  const tools = o.web ? { tools: WEB_TOOLS, allowedTools: WEB_TOOLS, maxTurns: WEB_MAX_TURNS } : { tools: [], maxTurns: 1 };
  let quotaPct5h: number | null = null;
  for await (const m of query({ prompt: fullPrompt, options: { model: o.model, ...tools, settingSources: [], ...(o.system && { systemPrompt: o.system }) } })) {
    // Cuota del plan (energía del pueblo) y cuánto de la ventana de 5 h gastó esta llamada (para el Encargado).
    if (m.type === "rate_limit_event") {
      const reading = parseRateLimit(m.rate_limit_info);
      quotaPct5h = quotaSpend(await getEnergy().catch(() => null), reading);
      await saveEnergy(reading).catch((e) => console.error("[energía]", String(e)));
    }
    if (m.type !== "result") continue;
    if (m.subtype !== "success") throw new Error(`Claude: ${m.subtype}`);
    const text = m.result.trim();
    return {
      text,
      json: o.schema ? parseJson(text) : undefined,
      brain: "claude",
      model: o.model,
      usage: { ...m.usage, estimatedCostUsd: m.total_cost_usd, quotaPct5h },
    };
  }
  throw new Error("Claude no devolvió resultado");
}

/** JSON de la respuesta. Después de buscar en internet, a veces viene con una frase antes: se toma de la primera llave a la última. */
export function parseJson(text: string): unknown {
  const t = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(t);
  } catch (err) {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a < 0 || b <= a) throw err;
    return JSON.parse(t.slice(a, b + 1));
  }
}
