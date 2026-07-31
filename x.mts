import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
const yol = "C:/Users/Nezif/OneDrive - RASYOTEK İNSAN KAYNAKLARI BİLİŞİM A.Ş/Belgeler/3 RAMAZAN ALTUĞ/DANIŞMANLIK ZİYARET NOTLARI/3. ZİYARET 06072026/TALEPLER FRANCHISE/FRANCHISE BAŞVURULARI_v3.xlsx";
const wb = XLSX.read(readFileSync(yol), { type: "buffer", cellDates: true });
const A = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["⚙️ Ayarlar"], { header: 1, blankrows: false, defval: null });
const kolon = (c: number) => A.slice(1).map((r) => r?.[c]).filter((v) => v !== null && String(v).trim() !== "").map((v) => String(v).trim());
console.log("── seçenek listeleri ──");
for (let c = 0; c <= 8; c++) {
  const bas = String(A[0]?.[c] ?? "").trim(); if (!bas) continue;
  console.log(`\n${bas}:`); kolon(c).forEach((v) => console.log(`   • ${v}`));
}
console.log("\n── puan ağırlıkları (Ayarlar P–W sütunları) ──");
for (const [ad, k, p] of [["Dükkan",15,16],["Bütçe",17,18],["Niyet-İstek",19,20],["İşi Yönetme",21,22]] as const) {
  console.log(`\n${ad}:`);
  for (const r of A.slice(1)) {
    const etiket = r?.[k], puan = r?.[p];
    if (etiket !== null && etiket !== undefined && String(etiket).trim()) console.log(`   ${String(puan).padStart(3)} ← ${String(etiket).trim()}`);
  }
}
// Veri tablosundaki gerçek kullanım
const V = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["📝 Veri Tablosu"], { defval: null });
const dolu = V.filter((r) => r["NO"]);
console.log(`\n── veri tablosu: ${dolu.length} dolu kayıt ──`);
const say = (alan: string) => {
  const m = new Map<string, number>();
  for (const r of dolu) { const v = r[alan] === null || String(r[alan]).trim() === "" ? "(boş)" : String(r[alan]).trim(); m.set(v, (m.get(v) ?? 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1]);
};
for (const alan of ["SON\r\nDURUM", "SON DURUM", "KANAL", "ŞİRKET\r\nSORUMLUSU", "ŞİRKET SORUMLUSU"]) {
  const s = say(alan); if (s.length && s[0][0] !== "(boş)") { console.log(`\n${alan.replace(/\r?\n/g," ")}: ${s.map(([k,v]) => `${k}=${v}`).join(" | ")}`); }
}
console.log(`\nkolon adları: ${Object.keys(dolu[0] ?? {}).map((k) => JSON.stringify(k)).join(", ")}`);
