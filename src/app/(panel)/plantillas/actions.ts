"use server";
// PROTOTIPO: acciones apagadas a propósito. Mismos nombres que el original para que la interfaz no cambie;
// no leen, no escriben ni mandan nada. El aviso al usuario lo muestra <PrototypeNotice />.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requestTemplate(..._args: any[]): Promise<any> {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function decideTemplate(..._args: any[]): Promise<any> {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function redoTemplate(..._args: any[]): Promise<any> {
  return undefined;
}
