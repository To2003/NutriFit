import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { authorizeCron } from "./cron";

const req = (auth?: string) => new NextRequest("http://x/api/cron/notifications", { method: "POST", headers: auth ? { authorization: auth } : {} });

describe("authorizeCron", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });
  it("sin CRON_SECRET configurado → 500 con mensaje claro", async () => {
    const r = authorizeCron(req("Bearer algo"))!;
    expect(r.status).toBe(500);
  });
  it("secreto incorrecto → 401", () => {
    process.env.CRON_SECRET = "abc";
    expect(authorizeCron(req("Bearer xyz"))!.status).toBe(401);
    expect(authorizeCron(req())!.status).toBe(401);
  });
  it("secreto correcto (tolera espacios/saltos de línea pegados) → pasa", () => {
    process.env.CRON_SECRET = "abc\n";
    expect(authorizeCron(req("Bearer abc"))).toBeNull();
    expect(authorizeCron(req(" Bearer abc "))).toBeNull();
  });
});
