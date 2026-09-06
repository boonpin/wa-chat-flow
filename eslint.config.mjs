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
    // Agent tooling that lives beside the app but is not part of it. Linting
    // someone else's vendored scripts with this project's rules only produces
    // noise that hides real findings in app code.
    ".agents/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
