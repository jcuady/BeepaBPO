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
    "scripts/**",
    // Vendored third-party skill bundle — CommonJS by design, not app code.
    "claude-seo/**",
    // Standalone landing-page design sandbox. `.gitignore:81` already excludes
    // it from the repository because it is not app code — but ESLint's flat
    // config does not read .gitignore, so `eslint .` walked into it and
    // reported 7 errors from a directory that is not part of this project.
    // Those 7 errors are real React rule violations in that sandbox; they are
    // simply not this repository's code, and letting them in meant `pnpm lint`
    // was permanently red and would stay red after any correct fix to app code.
    "BeepaBPO new landing design/**",
  ]),
]);

export default eslintConfig;
