import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Project overrides
  {
    files: ["**/*.{ts,tsx,js}"]
  },
  // Relax 'no-explicit-any' in backend/test harness to reduce noise while we migrate types
  {
    files: [
      "src/pages/api/**/*.ts",
      "src/pages/api/testesgeral.ts",
      "src/tests/**/*.ts",
      "tests/**/*.ts"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Allow CommonJS/require in scripts and turn off strict any in helpers
  {
    files: ["scripts/**/*.{ts,js}"]
    ,
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
