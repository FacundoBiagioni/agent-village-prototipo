"use server";
import { findLeads } from "@/lib/hud";
// PROTOTIPO: acciones apagadas a propósito. Mismos nombres que el original para que la interfaz no cambie;
// no leen, no escriben ni mandan nada. El aviso al usuario lo muestra <PrototypeNotice />.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createTask(..._args: any[]): Promise<any> {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function decide(..._args: any[]): Promise<any> {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function toggleBackground(..._args: any[]): Promise<any> {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setOfficeConfig(..._args: any[]): Promise<any> {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function addBasement(..._args: any[]): Promise<any> {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setBasementVariant(..._args: any[]): Promise<any> {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function deleteBasement(..._args: any[]): Promise<any> {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function moveAgent(..._args: any[]): Promise<any> {
  return undefined;
}

// La búsqueda sí funciona: solo lee la base inventada.
export async function searchBusinesses(q: string) {
  return findLeads(String(q));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveQuotaLimit(..._args: any[]): Promise<any> {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function equipSkill(..._args: any[]): Promise<any> {
  return undefined;
}
