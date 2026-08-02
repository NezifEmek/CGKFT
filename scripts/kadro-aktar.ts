// Mevcut adları yeni kadro yapısına taşır. 0018_kadro.sql çalıştıktan sonra
// BİR KEZ çalıştırılır: npx tsx scripts/kadro-aktar.mts
//
// Kaynaklar (bugün adların dağınık durduğu iki yer):
//   dokuman_ayarlari.pozisyonlar[].adSoyad      → görev tanımındaki ad
//   dokuman_ayarlari.prim_ayarlari.personel_*   → prim listeleri
//
// Bu ikisi çoktan ayrışmış: prim listesindeki 6 kişinin görev tanımı yok,
// üç pozisyonun ad alanına birden fazla kişi sıkıştırılmış
// ("Hossam ALRAJAB / Muhammed ABDULLAH (Vardiya Ekibi)").
//
// Bu yüzden kadro PRİM LİSTELERİNDEN kuruluyor — orada adlar tek tek ve
// temiz. Pozisyona bağlama ada göre yapılıyor; eşleşmeyenler atamasız
// bırakılıp raporlanıyor, uydurma eşleştirme yapılmıyor.
//
// Başlangıç tarihi BİLEREK boş bırakılıyor: kimin ne zaman başladığını
// bilmiyoruz ve uydurma tarih, geçmiş ay primlerini yanlış hesaplatır.
// Boş başlangıç "her zaman görevdeydi" anlamına gelir; ilk gerçek değişim
// girildiğinde tarih netleşir.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { asciiKatla } from "../src/lib/organizasyon";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8")
    .split(/\r?\n/)
    .filter((s) => s.trim() && !s.startsWith("#"))
    .map((s) => {
      const i = s.indexOf("=");
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    }),
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function yeniden<T>(f: () => PromiseLike<T>, kez = 5): Promise<T> {
  for (let i = 0; i < kez; i++) {
    try {
      return await f();
    } catch (e) {
      if (i === kez - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error("ulaşılamadı");
}

const { data: ayar } = await yeniden(() =>
  db.from("dokuman_ayarlari").select("pozisyonlar, prim_ayarlari").eq("id", 1).single(),
);

interface Poz { id: string; unvan: string; adSoyad: string }
const pozisyonlar = (ayar!.pozisyonlar as Poz[]) ?? [];
const pa = ayar!.prim_ayarlari as {
  personel_uretim: { ad: string; unvan: string }[];
  personel_merkez: { ad: string; unvan: string }[];
  merkez_sorumlu_ad: string; bolge1_ad: string; bolge2_ad: string;
};

// ─── Kadro listesi: prim listelerinden ────────────────────────────────
const kadro: { ad: string; grup: string }[] = [
  { ad: pa.merkez_sorumlu_ad, grup: "merkez_sorumlu" },
  { ad: pa.bolge1_ad, grup: "bolge1" },
  { ad: pa.bolge2_ad, grup: "bolge2" },
  ...pa.personel_uretim.map((p) => ({ ad: p.ad, grup: "uretim" })),
  ...pa.personel_merkez.map((p) => ({ ad: p.ad, grup: "merkez" })),
].filter((k) => k.ad && k.ad.trim());

console.log(`Prim listelerinden ${kadro.length} kişi okundu.\n`);

// ─── Pozisyon eşleştirme ──────────────────────────────────────────────
// Pozisyonun adSoyad alanı "A / B (Vardiya Ekibi)" gibi olabildiği için
// kişinin adı, pozisyon ad alanının İÇİNDE geçiyorsa eşleşme sayılıyor.
function pozisyonBul(kisiAdi: string): Poz | null {
  const k = asciiKatla(kisiAdi);
  if (!k) return null;
  const tam = pozisyonlar.find((p) => asciiKatla(p.adSoyad) === k);
  if (tam) return tam;
  return pozisyonlar.find((p) => asciiKatla(p.adSoyad).includes(k)) ?? null;
}

const eklenen: string[] = [];
const atanan: string[] = [];
const atanamayan: string[] = [];

for (const k of kadro) {
  const ad = k.ad.trim();

  const { data: varOlan } = await yeniden(() =>
    db.from("personeller").select("id").eq("ad_soyad", ad).maybeSingle(),
  );

  let personelId = varOlan?.id as string | undefined;
  if (!personelId) {
    const { data, error } = await yeniden(() =>
      db.from("personeller").insert({ ad_soyad: ad }).select("id").single(),
    );
    if (error) {
      console.log(`  ❌ ${ad}: ${error.message.slice(0, 60)}`);
      continue;
    }
    personelId = data!.id;
    eklenen.push(ad);
  }

  // Panel hesabı varsa bağla — aynı kişi iki yerde ayrı yaşamasın.
  const { data: profiller } = await yeniden(() => db.from("profiles").select("id, ad_soyad"));
  const profil = (profiller ?? []).find((p) => asciiKatla(p.ad_soyad ?? "") === asciiKatla(ad));
  if (profil) {
    await yeniden(() => db.from("personeller").update({ profil_id: profil.id }).eq("id", personelId!));
  }

  const poz = pozisyonBul(ad);
  if (!poz) {
    atanamayan.push(`${ad} (${k.grup})`);
    continue;
  }

  const { error: eAtama } = await yeniden(() =>
    db.from("pozisyon_atamalari").insert({
      pozisyon_id: poz.id,
      personel_id: personelId!,
      baslangic: null,
      bitis: null,
      prim_grubu: k.grup,
      aciklama: "Sisteme geçişte mevcut listelerden aktarıldı",
    }),
  );
  if (eAtama && !/duplicate key/i.test(eAtama.message)) {
    console.log(`  ⚠ ${ad} → ${poz.unvan}: ${eAtama.message.slice(0, 60)}`);
  } else {
    atanan.push(`${ad} → ${poz.unvan}`);
  }
}

console.log(`✓ Kadroya eklenen: ${eklenen.length}`);
console.log(`✓ Göreve bağlanan: ${atanan.length}`);
atanan.forEach((s) => console.log(`    ${s}`));

if (atanamayan.length) {
  console.log(`\n⚠ Görev tanımı bulunamadığı için ATAMASIZ kalan: ${atanamayan.length}`);
  atanamayan.forEach((s) => console.log(`    ${s}`));
  console.log(`  Bunlar için Doküman Yönetimi'nden görev tanımı açılıp Personel`);
  console.log(`  ekranından atama yapılmalı — uyarı listesinde de görünecekler.`);
}

// Kimsenin atanmadığı görev tanımları
const { data: tumAtama } = await yeniden(() =>
  db.from("pozisyon_atamalari").select("pozisyon_id").is("bitis", null),
);
const dolu = new Set((tumAtama ?? []).map((a) => a.pozisyon_id));
const bos = pozisyonlar.filter((p) => !dolu.has(p.id));
if (bos.length) {
  console.log(`\n⚠ Kimsenin atanmadığı görev tanımı: ${bos.length}`);
  bos.forEach((p) => console.log(`    ${p.unvan}${p.adSoyad ? ` — ad alanında: "${p.adSoyad}"` : ""}`));
}

const { count: pc } = await yeniden(() =>
  db.from("personeller").select("*", { count: "exact", head: true }),
);
const { count: ac } = await yeniden(() =>
  db.from("pozisyon_atamalari").select("*", { count: "exact", head: true }),
);
console.log(`\nSonuç: ${pc} personel, ${ac} atama.`);
