"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { AYLAR_12 } from "@/types/database";

export interface AktarilacakSatir {
  subeId: string;
  yil: number;
  ay: string;
  kg: number;
}

/**
 * Excel'den okunmuş kg satırlarını aylik_satislar'a yazar.
 * RLS devrede — kullanıcı yalnızca yetkili olduğu şubelere yazabilir.
 */
export async function satislariAktar(satirlar: AktarilacakSatir[]) {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") {
    return { hata: "İçe aktarma yetkiniz yok.", yazilan: 0 };
  }

  if (!Array.isArray(satirlar) || !satirlar.length) {
    return { hata: "Aktarılacak satır yok.", yazilan: 0 };
  }
  if (satirlar.length > 20000) {
    return { hata: "Tek seferde en fazla 20.000 satır aktarılabilir.", yazilan: 0 };
  }

  // Sunucu tarafında yeniden doğrula — istemciden gelen veriye güvenme.
  const temiz: AktarilacakSatir[] = [];
  for (const s of satirlar) {
    if (typeof s?.subeId !== "string" || !s.subeId) continue;
    if (!Number.isInteger(s.yil) || s.yil < 2000 || s.yil > 2100) continue;
    if (!AYLAR_12.includes(s.ay as (typeof AYLAR_12)[number])) continue;
    const kg = Number(s.kg);
    if (!Number.isFinite(kg) || kg < 0) continue;
    temiz.push({ subeId: s.subeId, yil: s.yil, ay: s.ay, kg });
  }

  if (!temiz.length) return { hata: "Geçerli satır bulunamadı.", yazilan: 0 };

  const supabase = await createClient();

  // Aktarılan (yıl, ay) çiftleri tanımlı değilse önce aylar tablosuna ekle,
  // yoksa veri girilir ama hiçbir ekranda görünmez.
  const ayCiftleri = new Map<string, { yil: number; ay: string }>();
  for (const s of temiz) ayCiftleri.set(`${s.yil}-${s.ay}`, { yil: s.yil, ay: s.ay });

  const { data: mevcutAylar } = await supabase.from("aylar").select("yil, ay");
  const mevcutSet = new Set((mevcutAylar ?? []).map((a) => `${a.yil}-${a.ay}`));
  const eksikAylar = [...ayCiftleri.entries()]
    .filter(([k]) => !mevcutSet.has(k))
    .map(([, v]) => ({ ...v, gun_sayisi: 30 }));

  if (eksikAylar.length) {
    const { error } = await supabase.from("aylar").upsert(eksikAylar, { onConflict: "yil,ay" });
    if (error) return { hata: "Ay tanımları eklenemedi: " + error.message, yazilan: 0 };
  }

  const PARCA = 500;
  let yazilan = 0;
  for (let i = 0; i < temiz.length; i += PARCA) {
    const parca = temiz.slice(i, i + PARCA).map((s) => ({
      sube_id: s.subeId,
      yil: s.yil,
      ay: s.ay,
      kg: s.kg,
      guncelleyen_id: profile.id,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("aylik_satislar")
      .upsert(parca, { onConflict: "sube_id,yil,ay" });

    if (error) {
      return {
        hata: `${yazilan} satır yazıldıktan sonra hata: ${error.message}`,
        yazilan,
      };
    }
    yazilan += parca.length;
  }

  revalidatePath("/aylar-veri");
  revalidatePath("/");
  return { hata: null, yazilan, eklenenAy: eksikAylar.length };
}

/**
 * Bir dönemin (yıl + ay) satış kayıtlarını siler.
 *
 * Nezif: "yüklediğimizi diğer verileri bozmadan silebilmemiz de çok
 * önemli." Yanlış dosya yüklendiğinde tek çare, o dönemi temizleyip
 * doğrusunu yüklemek.
 *
 * Silme YALNIZCA verilen yıl+ay ile sınırlı; başka ay ya da yıl asla
 * etkilenmez. `ay` doğrulanıyor, boş/serbest metin kabul edilmiyor —
 * hatalı bir değer geniş bir silmeye dönüşmesin.
 *
 * Ay TANIMI silinmiyor, yalnızca kg kayıtları. Ay tanımı ekranların
 * dönem listesini kuruyor; onu silmek başka raporları bozardı.
 */
export async function donemSatislariniSil(yil: number, ay: string) {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Dönem silme yetkisi admin ve genel müdürdedir.", silinen: 0 };
  }
  if (!Number.isInteger(yil) || yil < 2000 || yil > 2100) {
    return { hata: "Yıl geçersiz.", silinen: 0 };
  }
  if (!AYLAR_12.includes(ay as (typeof AYLAR_12)[number])) {
    return { hata: "Ay geçersiz.", silinen: 0 };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("aylik_satislar")
    .delete()
    .eq("yil", yil)
    .eq("ay", ay)
    .select("id");

  if (error) return { hata: "Silinemedi: " + error.message, silinen: 0 };

  revalidatePath("/aylar-veri");
  revalidatePath("/ice-disa-aktar");
  revalidatePath("/");
  return { hata: null, silinen: data?.length ?? 0 };
}
