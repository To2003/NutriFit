import { normalize } from "@/lib/text";

/**
 * Frases que el Profe nunca puede decir: compensar, quemar lo comido, ayunos extremos,
 * saltear comidas, comentarios sobre el cuerpo, culpa.
 */
const BANNED: RegExp[] = [
  /\bquema(r|lo|la|s)? (lo|la|las|los) (que )?(comi|comiste|comido)/,
  /\bquemar (esas|las|esa|la) (calorias|kcal)/,
  /\bcompensa(r|lo|la)?\b/,
  /\bayun(o|ar|as)\b/,
  /\bsalte(a|ar|ate)\w* (la|el|una|un)? ?(comida|cena|almuerzo|desayuno|merienda)/,
  /\bno (cenes|almuerces|desayunes|meriendes|comas nada)\b/,
  /\b(gord[oa]s?|flac[oa]s?|panza|rollo|celulitis|grasita|cuerpo de verano|lomo)\b/,
  /\b(culpa|portaste mal|te pasaste|mal comportamiento|pecado|trampa)\b/,
  /\bdesintoxic|\bdetox\b/,
];

export function violatesGuardrails(text: string): boolean {
  const t = normalize(text);
  return BANNED.some((re) => re.test(t));
}

/** Para menores (no aplica hoy: D2 solo mayores) y casos de ingesta muy baja: nada de "bajar". */
export function mentionsWeightLoss(text: string): boolean {
  return /\b(bajar de peso|adelgaz|perder peso|bajar kilos)\b/.test(normalize(text));
}
