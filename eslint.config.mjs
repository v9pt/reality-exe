import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "coverage/**", "next-env.d.ts"]),
  {
    // In the 3D layer, mutating three.js objects (camera, uniforms, materials) inside
    // the frame loop is the intended pattern, not a React state mistake.
    files: ["src/components/world/**"],
    rules: { "react-hooks/immutability": "off" },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);
