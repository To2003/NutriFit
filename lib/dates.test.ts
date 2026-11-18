import { describe, expect, it } from "vitest";
import { addDays, isoWeekday, todayInTz, weekStart } from "./dates";

describe("fechas", () => {
  it("todayInTz usa la zona del usuario", () => {
    // 02:00 UTC del 19/11 = 23:00 del 18/11 en Buenos Aires
    expect(todayInTz("America/Argentina/Buenos_Aires", new Date("2026-11-19T02:00:00Z"))).toBe("2026-11-18");
  });
  it("isoWeekday", () => {
    expect(isoWeekday("2026-11-16")).toBe(1); // lunes
    expect(isoWeekday("2026-11-22")).toBe(7); // domingo
  });
  it("weekStart y addDays", () => {
    expect(weekStart("2026-11-22")).toBe("2026-11-16");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
});
