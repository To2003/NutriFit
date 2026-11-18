import { describe, expect, it } from "vitest";
import { LIBRARY_BY_ID } from "./library-data";
import { loadsZone, painSafeReplacement } from "./pain";

describe("molestias", () => {
  it("rodilla: la pliometría y las sentadillas cargan la zona", () => {
    expect(loadsZone(LIBRARY_BY_ID.box_jump, "knee")).toBe(true);
    expect(loadsZone(LIBRARY_BY_ID.back_squat, "knee")).toBe(true);
    expect(loadsZone(LIBRARY_BY_ID.bench_press, "knee")).toBe(false);
  });
  it("hombro: el press militar se reemplaza o se quita", () => {
    expect(loadsZone(LIBRARY_BY_ID.overhead_press, "shoulder")).toBe(true);
    const rep = painSafeReplacement(LIBRARY_BY_ID.overhead_press, "shoulder", LIBRARY_BY_ID);
    if (rep) expect(loadsZone(LIBRARY_BY_ID[rep], "shoulder")).toBe(false);
  });
  it("isquios: el rumano pasa a algo que no los cargue o se quita", () => {
    const rep = painSafeReplacement(LIBRARY_BY_ID.rdl, "hamstring", LIBRARY_BY_ID);
    if (rep) expect(loadsZone(LIBRARY_BY_ID[rep], "hamstring")).toBe(false);
  });
});
