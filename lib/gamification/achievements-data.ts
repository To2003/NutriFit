export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  emoji: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "first_log", name: "Arrancó el partido", description: "Cargaste tu primera comida.", emoji: "🍽️" },
  { code: "first_workout", name: "Primer entreno", description: "Registraste tu primera sesión de gym.", emoji: "🏋️" },
  { code: "streak_7", name: "Una semana al hilo", description: "7 días seguidos cargando al menos 3 comidas.", emoji: "🔥" },
  { code: "streak_30", name: "Un mes imparable", description: "30 días seguidos cargando al menos 3 comidas.", emoji: "🏆" },
  { code: "water_7", name: "Camello", description: "7 días seguidos cumpliendo el agua.", emoji: "💧" },
  { code: "protein_7", name: "Proteína al día", description: "7 días seguidos llegando a la proteína.", emoji: "🥚" },
  { code: "first_pr", name: "Récord personal", description: "Superaste tu mejor 1RM estimado en un ejercicio.", emoji: "📈" },
  { code: "training_week", name: "Semana completa", description: "Cumpliste todas las sesiones planificadas de la semana.", emoji: "✅" },
  { code: "meso_complete", name: "Mesociclo completo", description: "Terminaste un mesociclo de 4 semanas.", emoji: "🎯" },
  { code: "jump_plus_3", name: "Resorte", description: "+3 cm de salto vertical (CMJ) desde tu primer test.", emoji: "🦘" },
  { code: "jump_plus_5", name: "Te sale volando", description: "+5 cm de salto vertical (CMJ) desde tu primer test.", emoji: "🚀" },
  { code: "four_weeks_logging", name: "Cuatro semanas cargando", description: "Cargaste comidas al menos 5 días por semana durante 4 semanas.", emoji: "📒" },
  { code: "first_test", name: "Medido y pesado", description: "Hiciste tu primer test físico.", emoji: "⏱️" },
];
