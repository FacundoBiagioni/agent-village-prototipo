/** Texto legible de un pedido de aprobación (texto plano, sin formato, para no tener que escapar nada). */
export function approvalText(actionType: string, payload: unknown) {
  const p = (payload ?? {}) as Record<string, string | null>;
  if (actionType === "whatsapp_message")
    return [`Mensaje de WhatsApp para ${p.negocio} (${p.whatsapp}):`, "", p.mensaje, p.aviso ? `\nOjo: ${p.aviso}` : ""].join("\n").trim();
  if (actionType === "publish_demo") {
    const head = `Publicar en internet la demo de ${p.negocio}.\nQuedaría en: ${p.quedaEn}`;
    if (p.mensaje) return [head, "", `Y dejar listo este mensaje de WhatsApp para ${p.whatsapp} (lo mandás vos):`, "", p.mensaje].join("\n");
    return p.aviso ? `${head}\n\nOjo: ${p.aviso}` : head;
  }
  if (actionType === "publish_site") {
    const q = (payload ?? {}) as { negocio?: string; proyecto?: string; carpeta?: string; paginas?: number; dominio?: string | null; reactivar?: boolean };
    return [
      `${q.reactivar ? "Reactivar" : "Publicar"} en Vercel el sitio de ${q.negocio} (${q.paginas} ${q.paginas === 1 ? "página" : "páginas"}, proyecto ${q.proyecto}).`,
      q.dominio ? `Con su dominio: ${q.dominio} (y www).` : "Sin dominio todavía: queda en la dirección de Vercel.",
      `Lo podés revisar antes en: ${q.carpeta}`,
    ].join("\n");
  }
  if (actionType === "pause_site") {
    const q = (payload ?? {}) as { negocio?: string; motivo?: string };
    return `Pausar el sitio de ${q.negocio} (${q.motivo}): se reemplaza por una página de "Sitio en mantenimiento". No se borra nada y se reactiva cuando pague.`;
  }
  if (actionType === "install_skill") {
    const q = (payload ?? {}) as { name?: string; licencia?: string; origen?: string; tokens?: number; avisos?: string[]; descripcion?: string };
    const warnings = q.avisos?.length ? `Avisos de la revisión:\n- ${q.avisos.join("\n- ")}` : "La revisión no encontró nada raro.";
    return [`Instalar la skill "${q.name}" (licencia ${q.licencia}, ~${q.tokens} tokens por pedido).`, q.descripcion ?? "", `Origen: ${q.origen}`, warnings, "Solo se copia el texto de la skill (SKILL.md), nunca programas."].filter(Boolean).join("\n");
  }
  return `Pedido "${actionType}":\n${JSON.stringify(payload, null, 2)}`;
}
