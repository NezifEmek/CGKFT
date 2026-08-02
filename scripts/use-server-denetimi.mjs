// "use server" dosyalarından yalnızca async fonksiyon ihraç edilebilir.
//
// Neden bir denetim betiği var: bu hata üç kez yapıldı (hızlı skor, haftalık
// faaliyet, öneriler). Belirtisi sinsi — tip kontrolü ve derleme geçiyor,
// sayfa açılıyor, ama sabiti KULLANAN parça ilk kez render edildiğinde
// çalışma anında patlıyor. Örneğin "plana ekle" formu açılana kadar hiçbir
// şey belli olmuyordu.
//
// Sebep: "use server" bir dosyanın TÜM ihraçlarını sunucu eylemi referansına
// çevirir. İstemci `PLAN_TURLERI` diye bir dizi beklerken bir eylem
// referansı alır ve `.map is not a function` hatası alır.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const KOK = "src";
const ihlaller = [];

function tara(dizin) {
  for (const ad of readdirSync(dizin)) {
    const yol = join(dizin, ad);
    if (statSync(yol).isDirectory()) {
      tara(yol);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(ad)) continue;

    const icerik = readFileSync(yol, "utf8");
    // Dosyanın BAŞINDA olmalı; yorumda geçen "use server" sayılmaz.
    const ilkSatirlar = icerik.split(/\r?\n/).slice(0, 3).join("\n");
    if (!/^\s*["']use server["'];/m.test(ilkSatirlar)) continue;

    icerik.split(/\r?\n/).forEach((satir, i) => {
      // export type / export interface güvenli: derleme sonrası silinir.
      const m = satir.match(/^export\s+(const|let|var|class|enum)\s+([A-Za-z0-9_$]+)/);
      if (m) ihlaller.push({ yol, satir: i + 1, tur: m[1], ad: m[2] });
    });
  }
}

tara(KOK);

if (ihlaller.length) {
  console.error('\n"use server" dosyalarından yalnızca async fonksiyon ihraç edilebilir.\n');
  for (const i of ihlaller) {
    console.error(`  ${i.yol}:${i.satir}  export ${i.tur} ${i.ad}`);
  }
  console.error(
    "\nBunlar istemcide gerçek değer olarak görünmez; sabitleri ayrı bir\n" +
      "modüle taşıyın (örn. src/lib/plan.ts) ve iki taraf da oradan alsın.\n",
  );
  process.exit(1);
}

console.log(`✓ "use server" denetimi temiz`);
