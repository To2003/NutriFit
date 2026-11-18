import { describe, expect, it } from "vitest";
import { quotaBlock } from "./quota";

const L = { dailyPerUser: 25, monthlyPerUser: 400, dailyGlobal: 400 };
const q = (o: Partial<Parameters<typeof quotaBlock>[0] & object> = {}) => ({ user_day: 1, user_month: 1, global_day: 1, daily_cap: null, monthly_cap: null, ...o });

describe("quotaBlock", () => {
  it("dentro de los topes → permitido (la llamada actual ya está contada)", () => {
    expect(quotaBlock(q({ user_day: 25, user_month: 400, global_day: 400 }), L)).toBeNull();
  });
  it("pasado el tope diario del usuario", () => {
    expect(quotaBlock(q({ user_day: 26 }), L)).toBe("user_day");
  });
  it("pasado el tope mensual", () => {
    expect(quotaBlock(q({ user_month: 401 }), L)).toBe("user_month");
  });
  it("el tope global manda sobre todo", () => {
    expect(quotaBlock(q({ global_day: 401, daily_cap: 999 }), L)).toBe("global_day");
  });
  it("la excepción por usuario pisa el default (para más o para menos)", () => {
    expect(quotaBlock(q({ user_day: 40, daily_cap: 60 }), L)).toBeNull();
    expect(quotaBlock(q({ user_day: 6, daily_cap: 5 }), L)).toBe("user_day");
    expect(quotaBlock(q({ user_day: 1, daily_cap: 0 }), L)).toBe("user_day");
  });
  it("sin datos no bloquea", () => {
    expect(quotaBlock(null, L)).toBeNull();
  });
});
