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
    // app-src 是死碼（獨立巢狀 git repo、不在 build 內）；scripts 為一次性節點腳本。
    // 不該汙染 lint（否則 `eslint .` 多出數千筆雜訊 → 永遠無法把 lint 改成硬閘門）。
    "app-src/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
