// Tek seferlik veri taşıma: CigkofteRaporPaneli/data/data.json → Supabase.
// Çalıştırma: panel-web/ içinde `npm run migrate`
//
// Idempotent: her şube data.json'daki eski `id`'si `subeler.eski_id` kolonunda
// tutulur; script tekrar çalıştırılırsa aynı şubeler güncellenir, mükerrer
// satır oluşmaz. Aylık satışlar (sube_id, yil, ay) benzersizliğine göre upsert
// edilir.

import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Next.js .env.local'ı otomatik okur ama düz Node script'ler okumaz — elle yükle.
loadEnv({ path: resolve(__dirname, "../.env.local") });

const DATA_JSON_PATH = resolve(
  __dirname,
  "../../CigkofteRaporPaneli/CigkofteRaporPaneli/data/data.json",
);

const CARI_YIL = 2026; // data.json'daki "satislar" alanının yılı
const ONCEKI_YIL = 2025; // "satislar2025" alanının yılı

interface EskiSube {
  id: string;
  bolge: string;
  tip: string;
  ad: string;
  il?: string;
  ilce?: string;
  kod?: string;
  merkezYetkilisi?: string;
  subeYetkilisi?: string;
  ilSubeSirasi?: string;
  aktif?: boolean;
  acilisTarihi?: string | null;
  kapanisTarihi?: string | null;
  acilisTahmini?: boolean;
  fiyatGrubu?: string | null;
  satislar?: Record<string, number>;
  satislar2025?: Record<string, number>;
}

interface EskiVeri {
  meta?: { gun_sayilari?: Record<string, number> };
  aylar?: string[];
  subeler: EskiSube[];
  denetimler?: unknown[];
  skorlar?: unknown[];
}

function ortam(anahtar: string): string {
  const deger = process.env[anahtar];
  if (!deger || deger.startsWith("placeholder")) {
    throw new Error(
      `${anahtar} tanımlı değil (ya da hâlâ yer tutucu değer). .env.local dosyasını gerçek ` +
        `Supabase bilgileriyle doldurup tekrar deneyin.`,
    );
  }
  return deger;
}

async function main() {
  console.log("data.json okunuyor:", DATA_JSON_PATH);
  const eski: EskiVeri = JSON.parse(readFileSync(DATA_JSON_PATH, "utf-8"));

  const supabase = createClient(
    ortam("NEXT_PUBLIC_SUPABASE_URL"),
    ortam("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // ── 1) aylar (gün sayılarıyla, güncel yıl + geçmiş yıl için 12 ay varsayılan) ─
  const ayKayitlari: { yil: number; ay: string; gun_sayisi: number }[] = [];
  const gunSayilari = eski.meta?.gun_sayilari ?? {};
  for (const ay of eski.aylar ?? []) {
    ayKayitlari.push({ yil: CARI_YIL, ay, gun_sayisi: gunSayilari[ay] ?? 30 });
  }
  const oncekiYilAylari = new Set<string>();
  for (const s of eski.subeler) {
    for (const ay of Object.keys(s.satislar2025 ?? {})) oncekiYilAylari.add(ay);
  }
  for (const ay of oncekiYilAylari) {
    ayKayitlari.push({ yil: ONCEKI_YIL, ay, gun_sayisi: 30 });
  }
  if (ayKayitlari.length) {
    const { error } = await supabase.from("aylar").upsert(ayKayitlari, { onConflict: "yil,ay" });
    if (error) throw new Error("aylar upsert hatası: " + error.message);
  }
  console.log(`✓ ${ayKayitlari.length} ay kaydı yazıldı.`);

  // ── 2) subeler (eski_id ile idempotent upsert) ────────────────────────────
  const subeSatirlari = eski.subeler.map((s) => ({
    eski_id: s.id,
    bolge: s.bolge || "TANIMSIZ",
    tip: s.tip === "MŞ" ? "MS" : "FR",
    ad: s.ad || "İsimsiz Şube",
    il: s.il || "",
    ilce: s.ilce || "",
    kod: s.kod || "",
    merkez_yetkilisi: s.merkezYetkilisi || "",
    sube_yetkilisi: s.subeYetkilisi || "",
    il_sube_sirasi: s.ilSubeSirasi || "",
    aktif: s.aktif !== false,
    acilis_tarihi: s.acilisTarihi || null,
    kapanis_tarihi: s.kapanisTarihi || null,
    acilis_tahmini: !!s.acilisTahmini,
    fiyat_grubu: s.tip === "FR" ? (s.fiyatGrubu === "lojistik" ? "lojistik" : "dagitim") : null,
  }));

  const { data: yazilanSubeler, error: subeHata } = await supabase
    .from("subeler")
    .upsert(subeSatirlari, { onConflict: "eski_id" })
    .select("id, eski_id");

  if (subeHata) throw new Error("subeler upsert hatası: " + subeHata.message);
  console.log(`✓ ${yazilanSubeler?.length ?? 0} şube yazıldı.`);

  const eskiIdToYeniId = new Map<string, string>();
  for (const s of yazilanSubeler ?? []) {
    if (s.eski_id) eskiIdToYeniId.set(s.eski_id, s.id);
  }

  // ── 3) aylik_satislar (satislar → CARI_YIL, satislar2025 → ONCEKI_YIL) ────
  const satisSatirlari: { sube_id: string; yil: number; ay: string; kg: number }[] = [];
  for (const s of eski.subeler) {
    const yeniId = eskiIdToYeniId.get(s.id);
    if (!yeniId) continue;
    for (const [ay, kg] of Object.entries(s.satislar ?? {})) {
      satisSatirlari.push({ sube_id: yeniId, yil: CARI_YIL, ay, kg: Number(kg) || 0 });
    }
    for (const [ay, kg] of Object.entries(s.satislar2025 ?? {})) {
      satisSatirlari.push({ sube_id: yeniId, yil: ONCEKI_YIL, ay, kg: Number(kg) || 0 });
    }
  }

  // Büyük veri setlerinde tek istekte göndermemek için 500'lük parçalar halinde yaz.
  const PARCA = 500;
  for (let i = 0; i < satisSatirlari.length; i += PARCA) {
    const parca = satisSatirlari.slice(i, i + PARCA);
    const { error } = await supabase
      .from("aylik_satislar")
      .upsert(parca, { onConflict: "sube_id,yil,ay" });
    if (error) throw new Error("aylik_satislar upsert hatası: " + error.message);
  }
  console.log(`✓ ${satisSatirlari.length} aylık satış kaydı yazıldı.`);

  console.log("\nTaşıma tamamlandı.");
}

main().catch((err) => {
  console.error("\n✗ Taşıma başarısız:", err.message ?? err);
  process.exit(1);
});
