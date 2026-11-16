// PROTOTIPO: el original transmite en vivo lo que hacen los agentes (pg LISTEN). Acá no pasa nada en vivo:
// se abre la conexión, se pide reintentar recién en un día y se cierra, así no hay pedidos repetidos.
export function GET() {
  return new Response("retry: 86400000\n\n", { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
}
