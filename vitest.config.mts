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
          // The first run downloads three models, which takes a while, so the
          // eval runs one file at a time.
          testTimeout: 15 * 60 * 1000,
          hookTimeout: 60 * 1000,
          fileParallelism: false,
        },
      },
    ],
  },
});
