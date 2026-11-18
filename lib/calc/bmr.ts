import type { BodyData } from "./types";

function assertPositive(name: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} inválido: ${value}`);
  }
}

/** Metabolismo basal (kcal/día) — Mifflin-St Jeor. */
export function bmrMifflin({ sex, weightKg, heightCm, ageYears }: BodyData): number {
  assertPositive("peso", weightKg);
  assertPositive("altura", heightCm);
  assertPositive("edad", ageYears);
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === "male" ? base + 5 : base - 161;
}

/** Edad en años cumplidos. `birthdate` en formato ISO (YYYY-MM-DD). */
export function ageFromBirthdate(birthdate: string, today: Date = new Date()): number {
  const [y, m, d] = birthdate.split("-").map(Number);
  let age = today.getFullYear() - y;
  const month = today.getMonth() + 1;
  const day = today.getDate();
  if (month < m || (month === m && day < d)) age -= 1;
  return age;
}
