// Temas de toda la interfaz (botón Skins): cambian los colores, bordes y sombras de barras, ventanas y pantallas.
// El dibujo de cada tema vive en hud.css (.hud[data-ui="..."]). "juego" respeta el botón de claro/oscuro.
export const UI_THEMES: { id: string; name: string; idea: string; swatch: [string, string, string] }[] = [
  { id: "juego", name: "Juego de oficina", idea: "El de siempre: tinta índigo, amarillo moneda y sombras duras.", swatch: ["#fafbfe", "#241e3b", "#ffc93c"] },
  { id: "madera", name: "Cabaña de madera", idea: "Pergamino, madera y tinta marrón; títulos de cuento.", swatch: ["#fff8ea", "#3a261b", "#f2b33a"] },
  { id: "papel", name: "Cuaderno", idea: "Hoja cuadriculada, tinta azul y resaltador amarillo.", swatch: ["#fffdf7", "#1f3a6e", "#ffe45c"] },
  { id: "pastel", name: "Caramelo", idea: "Lavanda, rosa y menta, todo redondito.", swatch: ["#ffffff", "#5a4590", "#ffb3d1"] },
  { id: "bosque", name: "Bosque de noche", idea: "Verde musgo oscuro con acentos lima.", swatch: ["#2a3a31", "#eef3e6", "#c9d65a"] },
  { id: "neon", name: "Neón", idea: "Violeta casi negro, bordes que brillan en rosa y aqua.", swatch: ["#1a1630", "#ff5fa2", "#7df0d0"] },
  { id: "arcade", name: "Arcade", idea: "Negro, azul eléctrico y rojo; pixeles gruesos como en un fichín.", swatch: ["#0d0d1a", "#2f6bff", "#ff3b3b"] },
];
