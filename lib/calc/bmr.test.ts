import { describe, expect, it } from "vitest";
import { ageFromBirthdate, bmrMifflin } from "./bmr";

describe("bmrMifflin", () => {
  it("hombre: 10·kg + 6,25·cm − 5·edad + 5", () => {
    // 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
    expect(bmrMifflin({ sex: "male", weightKg: 80, heightCm: 180, ageYears: 25 })).toBe(1805);
  });

  it("mujer: 10·kg + 6,25·cm − 5·edad − 161", () => {
    // 600 + 1031.25 - 150 - 161 = 1320.25
    expect(bmrMifflin({ sex: "female", weightKg: 60, heightCm: 165, ageYears: 30 })).toBeCloseTo(1320.25);
  });

  it("rechaza datos imposibles", () => {
    expect(() => bmrMifflin({ sex: "male", weightKg: 0, heightCm: 180, ageYears: 25 })).toThrow();
    expect(() => bmrMifflin({ sex: "male", weightKg: 80, heightCm: -1, ageYears: 25 })).toThrow();
    expect(() => bmrMifflin({ sex: "male", weightKg: 80, heightCm: 180, ageYears: Number.NaN })).toThrow();
  });
});

describe("ageFromBirthdate", () => {
  const today = new Date("2026-11-18T12:00:00");
  it("cumple años después de hoy → todavía no los cumplió", () => {
    expect(ageFromBirthdate("2003-12-01", today)).toBe(22);
  });
  it("cumple hoy → ya los cumplió", () => {
    expect(ageFromBirthdate("2003-11-18", today)).toBe(23);
  });
  it("cumplió antes este año", () => {
    expect(ageFromBirthdate("2003-01-10", today)).toBe(23);
  });
  it("29 de febrero en año no bisiesto", () => {
    expect(ageFromBirthdate("2008-02-29", new Date("2026-02-28T12:00:00"))).toBe(17);
    expect(ageFromBirthdate("2008-02-29", new Date("2026-03-01T12:00:00"))).toBe(18);
  });
});
