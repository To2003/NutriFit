export const TEST_INFO = {
  cmj: {
    label: "Salto vertical (CMJ)",
    unit: "cm",
    higherIsBetter: true,
    how: "Parado al lado de una pared con tiza en los dedos: marcá tu alcance de pie. Saltá con contramovimiento (bajada rápida y salto con brazos) y marcá lo más alto. CMJ = salto − alcance. 3 intentos, vale el mejor. Con app de celular (tipo My Jump) también sirve.",
  },
  reach_jump: {
    label: "Salto con alcance",
    unit: "cm",
    higherIsBetter: true,
    how: "Con 2–3 pasos de carrera (como un ataque), saltá y tocá lo más alto que puedas. Anotá la altura total alcanzada. 3 intentos.",
  },
  broad_jump: {
    label: "Salto en largo",
    unit: "cm",
    higherIsBetter: true,
    how: "Pies juntos detrás de una línea, saltá hacia adelante con ambos pies y aterrizá sin caerte. Medí hasta el talón más cercano. 3 intentos.",
  },
  sprint_10: {
    label: "Sprint 10 m",
    unit: "s",
    higherIsBetter: false,
    how: "Salida parada, cronometrá 10 m (ideal con fotocélulas o con un compañero filmando a 240 fps). Calentá bien. 2–3 intentos con 2 min de pausa.",
  },
  sprint_20: {
    label: "Sprint 20 m",
    unit: "s",
    higherIsBetter: false,
    how: "Igual que el de 10 m pero hasta 20 m. Mismo lugar y calzado siempre, para comparar.",
  },
  plank: {
    label: "Plancha",
    unit: "s",
    higherIsBetter: true,
    how: "Plancha en antebrazos con cuerpo recto. Cortás cuando la cadera cae o sube. Un solo intento.",
  },
} as const;
export type TestKind = keyof typeof TEST_INFO;
