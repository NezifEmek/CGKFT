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
    // Doğrulama betiklerinin geçici çıktıları ve veri yedekleri.
    "yedek/**",
  ]),
  {
    rules: {
      // useActionState ile kullanılan server action'ların ilk parametresi
      // (önceki durum) React tarafından zorunlu tutuluyor ama çoğu eylemde
      // kullanılmıyor. Alt çizgiyle başlayan parametreler "bilerek
      // kullanılmıyor" demektir; uyarı üretmesinler.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
