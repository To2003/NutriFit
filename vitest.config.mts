import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // "server-only" corta el import fuera de Next; en tests es un módulo vacío.
    alias: { "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    // `pnpm sim:agent` corre solo el simulador; `pnpm test` lo excluye.
    include: process.env.SIM ? ["tests/sim/**/*.test.ts"] : ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: process.env.SIM ? [] : ["tests/sim/**", "node_modules/**"],
    testTimeout: 30000,
  },
});
