import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    clearMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}", "evals/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "eval",
          include: ["evals/**/*.eval.ts"],
          // Model downloads on a cold cache take a while; the suites run in order.
          testTimeout: 15 * 60 * 1000,
          hookTimeout: 60 * 1000,
          fileParallelism: false,
        },
      },
    ],
  },
});
