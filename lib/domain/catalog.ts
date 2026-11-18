import type { Goal, Intensity, Lifestyle, Pace, Sport } from "@/lib/calc/types";

export const SPORT_INFO: Record<Sport, { label: string; emoji: string; positions?: string[] }> = {
  volleyball: { label: "Vóley", emoji: "🏐", positions: ["Punta", "Armador/a", "Central", "Opuesto/a", "Líbero"] },
  beach_volleyball: { label: "Vóley playa", emoji: "🏖️" },
  field_hockey: { label: "Hockey", emoji: "🏑", positions: ["Arquero/a", "Defensor/a", "Volante", "Delantero/a"] },
  football: { label: "Fútbol", emoji: "⚽", positions: ["Arquero/a", "Defensor/a", "Mediocampista", "Delantero/a"] },
  basketball: { label: "Básquet", emoji: "🏀", positions: ["Base", "Escolta", "Alero", "Ala-pívot", "Pívot"] },
  handball: { label: "Handball", emoji: "🤾", positions: ["Arquero/a", "Central", "Lateral", "Extremo", "Pivote"] },
  rugby: { label: "Rugby", emoji: "🏉", positions: ["Forward", "Medio", "Back"] },
  padel_tennis: { label: "Pádel / tenis", emoji: "🎾" },
  running: { label: "Running", emoji: "🏃" },
  swimming: { label: "Natación", emoji: "🏊" },
  cycling: { label: "Bici", emoji: "🚴" },
  walking: { label: "Caminata", emoji: "🚶" },
  gym: { label: "Gimnasio", emoji: "🏋️" },
  other: { label: "Otro", emoji: "✨" },
};

/** Deportes que se ofrecen en el onboarding (gimnasio y caminata se cargan aparte). */
export const ONBOARDING_SPORTS: Sport[] = [
  "volleyball",
  "field_hockey",
  "football",
  "basketball",
  "handball",
  "rugby",
  "padel_tennis",
  "running",
  "swimming",
  "beach_volleyball",
  "cycling",
  "other",
];

export const LEVELS = [
  { value: "recreational", label: "Recreativo" },
  { value: "amateur", label: "Amateur competitivo" },
  { value: "federated", label: "Federado" },
] as const;

export const GOALS: { value: Goal; label: string; description: string; emoji: string }[] = [
  { value: "lose_fat", label: "Bajar grasa", description: "Déficit moderado, cuidando el rendimiento.", emoji: "🔥" },
  { value: "recomp", label: "Recomposición", description: "Déficit leve y mucha proteína: menos grasa, más músculo.", emoji: "🔁" },
  { value: "maintain", label: "Mantener", description: "Comer lo que gastás y ordenar hábitos.", emoji: "⚖️" },
  { value: "gain_muscle", label: "Ganar músculo", description: "Superávit chico para crecer sin pasarte.", emoji: "💪" },
  { value: "performance", label: "Solo rendimiento", description: "Que te dé la nafta para entrenar y jugar.", emoji: "⚡" },
];

export const PACES: { value: Pace; label: string; description: string }[] = [
  { value: "easy", label: "Tranqui", description: "0,25–0,5 % de tu peso por semana. Ideal si entrenás mucho." },
  { value: "moderate", label: "Moderado", description: "0,5–0,75 % por semana. El punto justo para la mayoría." },
  { value: "fast", label: "Rápido", description: "Hasta 1 % por semana. Puede afectar el rendimiento en cancha." },
];

export const LIFESTYLES: { value: Lifestyle; label: string; description: string }[] = [
  { value: "sedentary", label: "Mayormente sentado", description: "Oficina, facultad, home office." },
  { value: "mixed", label: "Mixto", description: "Algo de oficina y bastante caminata." },
  { value: "standing", label: "Mucho de pie", description: "Comercio, docencia, salud." },
  { value: "physical", label: "Laburo físico", description: "Construcción, reparto, depósito." },
];

export const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: "light", label: "Suave" },
  { value: "moderate", label: "Moderada" },
  { value: "hard", label: "Intensa" },
];

export const WEEKDAY_LABELS: Record<number, { short: string; long: string }> = {
  1: { short: "Lun", long: "lunes" },
  2: { short: "Mar", long: "martes" },
  3: { short: "Mié", long: "miércoles" },
  4: { short: "Jue", long: "jueves" },
  5: { short: "Vie", long: "viernes" },
  6: { short: "Sáb", long: "sábado" },
  7: { short: "Dom", long: "domingo" },
};

export const FOCUSES = [
  { value: "jump", label: "Salto vertical", emoji: "🦘" },
  { value: "power", label: "Potencia", emoji: "💥" },
  { value: "speed", label: "Velocidad y aceleración", emoji: "⚡" },
  { value: "stamina", label: "Stamina / resistencia", emoji: "🫁" },
  { value: "max_strength", label: "Fuerza máxima", emoji: "🏋️" },
  { value: "hypertrophy", label: "Hipertrofia", emoji: "💪" },
  { value: "recomp", label: "Recomposición corporal", emoji: "🔁" },
  { value: "injury_prevention", label: "Prevención de lesiones", emoji: "🛡️" },
  { value: "mobility", label: "Movilidad", emoji: "🧘" },
] as const;
export type Focus = (typeof FOCUSES)[number]["value"];

export const EQUIPMENT = [
  { value: "full_gym", label: "Gym completo" },
  { value: "barbell", label: "Barras y discos" },
  { value: "rack", label: "Rack / jaula" },
  { value: "dumbbells", label: "Mancuernas" },
  { value: "machines", label: "Máquinas" },
  { value: "cables", label: "Poleas" },
  { value: "trap_bar", label: "Trap bar" },
  { value: "box", label: "Cajón" },
  { value: "bands", label: "Bandas" },
  { value: "kettlebell", label: "Pesa rusa" },
  { value: "med_ball", label: "Balón medicinal" },
  { value: "bench", label: "Banco" },
  { value: "pullup_bar", label: "Barra de dominadas" },
  { value: "sled", label: "Trineo" },
] as const;

export const EXPERIENCE = [
  { value: "beginner", label: "Principiante", description: "Menos de 6 meses entrenando con pesas, o volviendo después de mucho." },
  { value: "intermediate", label: "Intermedio", description: "Entre 6 meses y 2 años, conocés los básicos." },
  { value: "advanced", label: "Avanzado", description: "Más de 2 años constante, técnica sólida." },
] as const;

export const DIET_TYPES = [
  { value: "omnivore", label: "Como de todo" },
  { value: "vegetarian", label: "Vegetariano/a" },
  { value: "vegan", label: "Vegano/a" },
  { value: "other", label: "Otro" },
] as const;

export const COOKING_TIMES = [
  { value: "low", label: "Poco", description: "Algo rápido o comprado." },
  { value: "normal", label: "Normal", description: "Cocino algo simple casi todos los días." },
  { value: "high", label: "Mucho", description: "Me gusta cocinar y le dedico tiempo." },
] as const;

export const MEALS = [
  { value: "breakfast", label: "Desayuno", emoji: "☕" },
  { value: "lunch", label: "Almuerzo", emoji: "🍽️" },
  { value: "snack", label: "Merienda", emoji: "🧉" },
  { value: "dinner", label: "Cena", emoji: "🌙" },
  { value: "extra", label: "Colación", emoji: "🍌" },
] as const;
export type Meal = (typeof MEALS)[number]["value"];

export const DAY_TYPE_INFO = {
  rest: { label: "Día de descanso", short: "Descanso", emoji: "😴" },
  training: { label: "Día de entreno", short: "Entreno", emoji: "🔥" },
  match: { label: "Día de partido", short: "Partido", emoji: "🏆" },
} as const;

export const SECTION_LABELS = {
  streaks: "Rachas y logros",
  training: "Entrenos y rutina",
  tests: "Tests físicos",
  meals: "Comidas",
  body: "Peso y medidas",
} as const;
export type Section = keyof typeof SECTION_LABELS;
