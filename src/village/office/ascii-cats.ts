// Gatos dibujados con caracteres para el HUD del modo ASCII: la cara (botones de arriba) y el cuerpo entero (ficha del agente).
// Salen de la misma raza (coatFor) y el mismo oficio (skin) que el modelo 3D, así cada uno se reconoce.
import { coatFor, SKINS } from "./characters";

const pad = (lines: string[]) => {
  const w = Math.max(...lines.map((l) => l.length));
  return lines.map((l) => l.padEnd(w));
};

/** Cara de 3 renglones, como en la demo: orejas, ojos con el accesorio del oficio y bigotes. */
export function asciiHead(agentId: string, skinId: string, chosen?: string): string {
  const skin = SKINS[skinId] ?? SKINS[agentId];
  const coat = coatFor(agentId, chosen);
  const ears = coat.fold ? " .-'-'-. " : coat.tufts ? " /\\^_^/\\ " : "  /\\_/\\  ";
  const eye = coat.id === "siames" ? "°" : coat.fluffy ? "^" : "o";
  let face = skin?.glasses ? ` (${eye}-.-${eye}) ` : ` ( ${eye}.${eye} ) `;
  if (skin?.headset) face = `@(${eye}.${eye})@`.padStart(9).padEnd(9);
  const chin = skin?.tie ? "   >Y<   " : skin?.scarf ? "  ~>^<~  " : "   >^<   ";
  return pad([ears, face, chin]).join("\n");
}

/** Cuerpo entero sentado, sobre una grilla fija de 21 columnas (centro en la 10): sombrero, cara, cuello, pelaje y lo que tiene en la mano. */
export function asciiBody(agentId: string, skinId: string, chosen?: string): string {
  const skin = SKINS[skinId] ?? SKINS[agentId];
  const coat = coatFor(agentId, chosen);
  const e = coat.id === "siames" ? "°" : coat.fluffy ? "^" : "o";
  // Relleno del pelaje (9 columnas): liso, atigrado, manchas, pechera de esmoquin, manchones o puntas oscuras.
  const [f1, f2, f3] =
    coat.pattern === "tabby" ? ["~ ~ ~ ~ ~", " ~ ~ ~ ~ ", "~ ~ ~ ~ ~"]
    : coat.pattern === "spots" ? ["o  .  o  ", "  o   . o", "o  .  o  "]
    : coat.id === "esmoquin" ? ["   |#|   ", "   |#|   ", "   |#|   "]
    : coat.patches ? ["%%   .   ", "   .   ##", "%%   .  #"]
    : coat.points ? ["  .   .  ", "         ", "  .   .  "]
    : ["         ", "         ", "         "];
  const hat = skin?.hat?.kind === "cap" ? ["      _______", "     /_______\\__"] : skin?.hat?.kind === "hardhat" ? ["      .-----.", "    _/_______\\_"] : skin?.pencil ? ["              /", "             /"] : [];
  const ears = coat.fold ? "     .-'''''''-." : coat.tufts ? "     /\\^_____^/\\" : "     /\\_______/\\";
  const eyes = skin?.glasses ? `    /  (${e})-(${e})  \\` : `    /  ${e}     ${e}  \\`;
  const cheeks = coat.fluffy ? "  {{  =   ^   =  }}" : skin?.headset ? "  @(  ==  ^  ==  )@" : "   (  ==  ^  ==  )";
  const neck = skin?.tie ? "    )     Y     (" : skin?.scarf ? "    ) ~~~~~~~~~ (" : "    )           (";
  const prop = skin?.prop === "magnifier" ? " -O" : skin?.prop === "clipboard" ? " [=]" : skin?.headset ? " )))" : "";
  const tail = coat.fluffy ? "~~}" : "~";
  return pad([...hat, ears, eyes, cheeks, neck, `   (  ${f1}  )`, `  ( ( ${f2} ) )${prop}`, ` ( (  ${f3}  ) )`, `(__(____)___(____)__)${tail}`]).join("\n");
}
