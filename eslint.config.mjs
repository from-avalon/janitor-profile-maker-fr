// Lint config. The studio's own code is classic <script> files sharing globals
// through window.*, so it is linted as scripts, not modules. Generated data
// files and the optional Next.js embed are skipped.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/**", ".deploy/**", "next/**",
              "preview/snapshot.js", "preview/fragments.js"] },
  js.configs.recommended,
  {
    files: ["js/**/*.js", "preview/frame.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser } },
    // Unused variables are worth seeing but not worth a red check.
    rules: { "no-unused-vars": "warn" },
  },
  {
    files: ["tools/**/*.mjs", "tests/**/*.mjs", "eslint.config.mjs"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node } },
  },
];
