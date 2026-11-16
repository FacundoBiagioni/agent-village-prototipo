// Bot de Telegram (PLAN 6.3): avisos y aprobaciones al celular. Solo habla con TELEGRAM_CHAT_ID; ignora a cualquier otro.
// Usa getUpdates (sondeo largo) desde el worker: no hace falta exponer la PC a internet.

import { approvalText } from "@/runtime/approval-text";

export { approvalText };

type Button = { text: string; callback_data?: string; url?: string };
type Update = {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number; text?: string } };
};

const token = () => process.env.TELEGRAM_BOT_TOKEN;
const chatId = () => Number(process.env.TELEGRAM_CHAT_ID);
export const telegramEnabled = () => !!token() && Number.isFinite(chatId()) && chatId() !== 0;

async function call<T = unknown>(method: string, body: object, timeoutMs = 15_000): Promise<T> {
  const r = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`); // nunca se loguea el token
  return j.result as T;
}

export async function sendText(text: string, buttons: Button[][] = []) {
  if (!telegramEnabled()) return;
  await call("sendMessage", { chat_id: chatId(), text: text.slice(0, 4000), ...(buttons.length && { reply_markup: { inline_keyboard: buttons } }) });
}

export async function notifyApproval(a: { id: string; actionType: string; payload: unknown }) {
  await sendText(`Espera tu aprobación\n\n${approvalText(a.actionType, a.payload)}`, [
    [
      { text: "Aprobar", callback_data: `ok:${a.id}` },
      { text: "Rechazar", callback_data: `no:${a.id}` },
    ],
  ]);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** "ok:<id>" | "no:<id>" | "sent:<id>"; cualquier otra cosa se ignora. */
export function parseCallback(data: string | undefined) {
  const [kind, id] = (data ?? "").split(":");
  if (!UUID.test(id ?? "")) return null;
  if (kind === "ok") return { kind: "approve" as const, id };
  if (kind === "no") return { kind: "reject" as const, id };
  if (kind === "sent") return { kind: "sent" as const, id };
  return null;
}

export type Handlers = {
  onApprove: (approvalId: string) => Promise<{ text: string; buttons?: Button[][] }>;
  onReject: (approvalId: string) => Promise<string>;
  onSent: (messageId: string) => Promise<string>;
};

/** Escucha botones y mensajes mientras corre el worker. */
export async function startPolling(h: Handlers, isRunning: () => boolean) {
  if (!telegramEnabled()) return;
  let offset: number | undefined;
  while (isRunning()) {
    try {
      const updates = await call<Update[]>("getUpdates", { offset, timeout: 25, allowed_updates: ["message", "callback_query"] }, 35_000);
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.message) {
          if (u.message.chat.id !== chatId()) continue; // no es el usuario: se ignora
          if (u.message.text?.startsWith("/start")) await sendText("Listo. Acá te aviso lo que espera tu aprobación, con botones para aprobar o rechazar.");
          continue;
        }
        const cq = u.callback_query;
        if (!cq || cq.message?.chat.id !== chatId()) continue;
        const action = parseCallback(cq.data);
        let reply = "Botón desconocido";
        let followUp: { text: string; buttons?: Button[][] } | null = null;
        try {
          if (action?.kind === "approve") {
            followUp = await h.onApprove(action.id);
            reply = "Aprobado";
          } else if (action?.kind === "reject") reply = await h.onReject(action.id);
          else if (action?.kind === "sent") reply = await h.onSent(action.id);
        } catch (err) {
          reply = String(err).replace(/^Error: /, "").slice(0, 190);
        }
        await call("answerCallbackQuery", { callback_query_id: cq.id, text: reply.slice(0, 190) }).catch(() => {});
        if (cq.message) await call("editMessageReplyMarkup", { chat_id: chatId(), message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
        await sendText(followUp?.text ?? reply, followUp?.buttons ?? []);
      }
    } catch (err) {
      console.error("[telegram]", String(err));
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
}
