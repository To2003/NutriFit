import { describe, expect, it } from "vitest";
import { isStaleDeployError } from "./stale";

describe("isStaleDeployError", () => {
  it("detecta Server Actions y chunks de un deploy viejo", () => {
    expect(isStaleDeployError(new Error('Server Action "7f3a" was not found on the server.'))).toBe(true);
    expect(isStaleDeployError(new Error("Failed to find Server Action \"abc\". This request might be from an older or newer deployment."))).toBe(true);
    const chunk = new Error("Loading chunk 123 failed.");
    chunk.name = "ChunkLoadError";
    expect(isStaleDeployError(chunk)).toBe(true);
  });
  it("no confunde otros errores", () => {
    expect(isStaleDeployError(new Error("No pudimos guardar"))).toBe(false);
    expect(isStaleDeployError(null)).toBe(false);
  });
});
