import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // DİKKAT: globalIgnores, ESLint'in kendi varsayılan yok sayma listesinin
    // YERİNE geçer — node_modules dahil. Burada yazılmazsa eslint hazır
    // paketlerin kaynağını da tarıyordu: `npm run lint` 7 dakika sürüp
    // 139.397 sorun bildiriyordu ve neredeyse hepsi zod, next gibi
    // paketlerdendi. Gerçek hatalar o yığının içinde görünmez oluyordu.
    //
    // Asıl koruma package.json'daki "eslint src scripts" — bu satır ikinci
    // emniyet, biri eslint'i çıplak çağırırsa diye.
    "**/node_modules/**",
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
