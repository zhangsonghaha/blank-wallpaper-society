import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: ["src/lib/db.ts", "src/lib/auth.ts"],
    },
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});