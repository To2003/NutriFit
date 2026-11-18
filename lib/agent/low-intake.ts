/**
 * Guardrail: varios días con registro completo muy por debajo del piso calórico.
 * En ese caso el Profe no felicita y sugiere, con tacto, hablar con un profesional.
 */
export function lowIntakeAlert(days: { meals: number; kcal: number }[], floorKcal: number): boolean {
  const complete = days.filter((d) => d.meals >= 3);
  const low = complete.filter((d) => d.kcal < floorKcal * 0.8);
  return low.length >= 3;
}

export const LOW_INTAKE_MESSAGE =
  "Che, estos días venís comiendo bastante por debajo de lo que tu cuerpo necesita para entrenar y jugar. No es para retarte: si te está costando comer o tenés dudas, está bueno charlarlo con un nutricionista o tu médico. Acá estoy para ayudarte con ideas.";
