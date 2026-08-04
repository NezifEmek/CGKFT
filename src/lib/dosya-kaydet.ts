// dosya-kaydet.ts — Tek bir dosyayı Storage'a + `dosyalar` tablosuna yazar.
//
// ── Neden ayrı bir modül ─────────────────────────────────────────────────
// Aynı işi iki yer yapıyor: dosya-actions.ts'teki "Yükle" düğmesi ve
// şikayet formundaki "Görseller" alanı (kayıt açılırken görsel eklenebilsin
// diye). İkisi de "use server" dosyası; oradan async olmayan yardımcı
// ihraç EDİLEMEZ, async ihraç edilirse de istemciden çağrılabilen bir uç
// noktaya dönüşür. Bu yüzden ortak mantık normal bir modülde duruyor.
//
// SUNUCU TARAFINA ÖZEL: service_role anahtarı kullanır, asla bir istemci
// bileşeninden import edilmemeli.

import { createAdminClient } from "@/lib/supabase/admin";
import { KOVA, AZAMI_BOYUT, turIzinliMi, yolUret } from "@/lib/dosya";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hataMesaji } from "@/lib/hata";

export interface YuklemeSonucu {
  ok?: string;
  hata?: string;
}

/**
 * Bir dosyayı yükler ve kaydeder.
 *
 * Sıra önemli: önce Storage, sonra veritabanı. Veritabanı yazımı
 * başarısız olursa yüklenen nesne SİLİNİR — yoksa kimsenin göremediği
 * çöp dosya kalır.
 */
export async function dosyayiKaydet(
  supabase: SupabaseClient,
  {
    kapsam, kayitId, dosya, aciklama = "", yukleyenId,
  }: {
    kapsam: string;
    kayitId: string;
    dosya: File;
    aciklama?: string;
    yukleyenId: string;
  },
): Promise<YuklemeSonucu> {
  if (!dosya.size) return { hata: `"${dosya.name}" boş görünüyor.` };

  if (dosya.size > AZAMI_BOYUT) {
    return {
      hata: `"${dosya.name}" çok büyük (${(dosya.size / 1048576).toFixed(1)} MB). Sınır ${
        AZAMI_BOYUT / 1048576
      } MB.`,
    };
  }
  if (!turIzinliMi(dosya.name, dosya.type)) {
    return {
      hata: `"${dosya.name}" türü kabul edilmiyor. PDF, resim, Word, Excel ve metin dosyaları yüklenebilir.`,
    };
  }

  const yol = yolUret(kapsam, kayitId, dosya.name);
  const admin = createAdminClient();

  const { error: yuklemeHata } = await admin.storage
    .from(KOVA)
    .upload(yol, dosya, {
      contentType: dosya.type || "application/octet-stream",
      upsert: false,
    });

  if (yuklemeHata) return { hata: kovaHatasi(yuklemeHata.message) };

  const { error: kayitHata } = await supabase.from("dosyalar").insert({
    kapsam,
    kayit_id: kayitId,
    yol,
    ad: dosya.name,
    boyut: dosya.size,
    mime: dosya.type || "",
    aciklama,
    yukleyen_id: yukleyenId,
  });

  if (kayitHata) {
    await admin.storage.from(KOVA).remove([yol]);
    return { hata: kovaHatasi(kayitHata.message) };
  }

  return { ok: dosya.name };
}

function kovaHatasi(mesaj: string): string {
  if (/relation .* does not exist/i.test(mesaj) || /schema cache/i.test(mesaj)) {
    return "Dosya tabloları henüz oluşturulmamış — 0015_dosyalar.sql çalıştırılmalı.";
  }
  if (/Bucket not found/i.test(mesaj)) {
    return "Depolama kovası bulunamadı — 0015_dosyalar.sql çalıştırılmalı.";
  }
  // Geri kalanı ortak çeviriciye — kullanıcı ham depolama hatası görmesin.
  return hataMesaji(mesaj, "Yüklenemedi");
}

/**
 * FormData'daki birden çok dosyayı sırayla yükler.
 * Biri başarısız olursa diğerleri denenmeye devam eder; hatalar toplanır.
 */
export async function dosyalariKaydet(
  supabase: SupabaseClient,
  {
    kapsam, kayitId, dosyalar, yukleyenId,
  }: {
    kapsam: string;
    kayitId: string;
    dosyalar: File[];
    yukleyenId: string;
  },
): Promise<{ yuklenen: number; hatalar: string[] }> {
  let yuklenen = 0;
  const hatalar: string[] = [];

  for (const dosya of dosyalar) {
    const sonuc = await dosyayiKaydet(supabase, { kapsam, kayitId, dosya, yukleyenId });
    if (sonuc.hata) hatalar.push(sonuc.hata);
    else yuklenen++;
  }

  return { yuklenen, hatalar };
}

/** FormData'dan gerçek (boş olmayan) dosyaları süzer. */
export function formdanDosyalar(degerler: FormDataEntryValue[]): File[] {
  return degerler.filter((d): d is File => d instanceof File && d.size > 0);
}
