import { describe, expect, it } from "vitest";
import { inQuietHours, inWindow, waterSlot } from "./schedule";

describe("horarios de notificaciones", () => {
  it("silencio que cruza medianoche", () => {
    expect(inQuietHours("23:45", "23:30", "08:00")).toBe(true);
    expect(inQuietHours("07:59", "23:30", "08:00")).toBe(true);
    expect(inQuietHours("08:00", "23:30", "08:00")).toBe(false);
    expect(inQuietHours("14:00", "23:30", "08:00")).toBe(false);
  });
  it("silencio en el mismo día", () => {
    expect(inQuietHours("14:30", "14:00", "16:00")).toBe(true);
  });
  it("ventana de 15 min", () => {
    expect(inWindow("22:00", "22:00")).toBe(true);
    expect(inWindow("22:14", "22:00")).toBe(true);
    expect(inWindow("22:15", "22:00")).toBe(false);
    expect(inWindow("21:59", "22:00")).toBe(false);
  });
  it("agua cada 2 h entre 9 y 21", () => {
    expect(waterSlot("09:05", "09:00", "21:00", 2)).toBeNull(); // arranque del día: no
    expect(waterSlot("11:05", "09:00", "21:00", 2)).toBe(2);
    expect(waterSlot("12:05", "09:00", "21:00", 2)).toBeNull();
    expect(waterSlot("11:20", "09:00", "21:00", 2)).toBeNull();
    expect(waterSlot("22:00", "09:00", "21:00", 2)).toBeNull();
  });
});
