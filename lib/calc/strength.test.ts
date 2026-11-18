import { describe, expect, it } from "vitest";
import { epley1RM, sessionVolume, volumeByMuscle } from "./strength";

describe("epley1RM", () => {
  it("kg × (1 + reps/30)", () => {
    expect(epley1RM(100, 5)).toBeCloseTo(116.667, 2);
    expect(epley1RM(60, 10)).toBe(80);
  });
  it("1 rep = el peso", () => {
    expect(epley1RM(140, 1)).toBe(140);
  });
  it("0 reps o 0 kg → 0", () => {
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(0, 8)).toBe(0);
  });
});

describe("volumen", () => {
  const sets = [
    { exerciseId: "squat", kg: 100, reps: 5 },
    { exerciseId: "squat", kg: 100, reps: 5 },
    { exerciseId: "bench", kg: 60, reps: 10 },
    { exerciseId: "plank", kg: 0, reps: 1 },
  ];
  it("Σ kg × reps", () => {
    expect(sessionVolume(sets)).toBe(1600);
  });
  it("por grupo muscular (un ejercicio suma a todos sus grupos)", () => {
    const muscles = { squat: ["quads", "glutes"], bench: ["chest", "triceps"], plank: ["core"] };
    expect(volumeByMuscle(sets, muscles)).toEqual({ quads: 1000, glutes: 1000, chest: 600, triceps: 600, core: 0 });
  });
});
