"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { kilogramaCevir, OLCU_BIRIMLERI, type Urun } from "@/lib/uretim";

type Sonuc = { hata?: string; ok?: string };
const YOL = "/uretim";

const m = (f: FormData, a: string) => String(f.get(a) ?? "").trim();

function tabloHatasi(mesaj: string): string | null {
  if (/relation .* does not exist/i.test(mesaj) || /schema cache/i.test(mesaj)) {
    return "Üretim tabloları henüz oluşturulmamış — 0013_uretim.sql çalıştırılmalı.";
  }
  return null;
}

async function yazabilirMi() {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") return { profile, hata: "Bu işlem için yetkiniz yok." };
  return { profile, hata: null };
}

// ─── Üretim kaydı ─────────────────────────────────────────────────────────

export async function kayitKaydet(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const { profile, hata } = await yazabilirMi();
  if (hata) return { hata };

  const miktarHam = m(formData, "miktar").replace(",", ".");
  const miktar = Number(miktarHam);
  if (!miktarHam || !Number.isFinite(miktar) || miktar < 0) {
    return { hata: "Miktar geçerli bir sayı olmalı." };
  }

  const urunId = m(formData, "urun_id");
  if (!urunId) return { hata: "Ürün seçilmeli." };

  const olcuBirimi = (OLCU_BIRIMLERI as readonly string[]).includes(m(formData, "olcu_birimi"))
    ? m(formData, "olcu_birimi")
    : "Adet";

  const supabase = await createClient();
  const { data: urun, error: urunHata } = await supabase
    .from("uretim_urunleri")
    .select("*")
    .eq("id", urunId)
    .maybeSingle<Urun>();

  if (urunHata) return { hata: tabloHatasi(urunHata.message) ?? "Ürün okunamadı: " + urunHata.message };
  if (!urun) return { hata: "Seçilen ürün bulunamadı." };

  const kg = kilogramaCevir(miktar, olcuBirimi, urun);

  const alanlar = {
    tarih: m(formData, "tarih") || new Date().toISOString().slice(0, 10),
    // Tesis / hat / vardiya kaldırıldı (Nezif: "bu yapıda gerek yok").
    // Sütunlar veritabanında duruyor ama artık yazılmıyor — eski kayıtların
    // içeriği bozulmasın diye silinmedi.
    urun_id: urun.id,
    // Ürün tanımı sonradan değişse bile kayıt okunabilir kalsın.
    urun_kod: urun.kod,
    urun_ad: urun.ad,
    urun_grup: urun.grup,
    ambalaj_tipi: urun.ambalaj_tipi,
    miktar,
    olcu_birimi: olcuBirimi,
    kg_karsiligi: kg,
    parti_no: m(formData, "parti_no"),
    skt: m(formData, "skt") || null,
    operator: m(formData, "operator"),
    aciklama: m(formData, "aciklama"),
    guncelleyen_id: profile.id,
    updated_at: new Date().toISOString(),
  };

  const id = m(formData, "kayit_id");
  const { error } = id
    ? await supabase.from("uretim_kayitlari").update(alanlar).eq("id", id)
    : await supabase.from("uretim_kayitlari").insert({ ...alanlar, olusturan_id: profile.id });

  if (error) {
    return { hata: tabloHatasi(error.message) ?? ((id ? "Güncellenemedi: " : "Kaydedilemedi: ") + error.message) };
  }

  revalidatePath(YOL);
  return {
    ok:
      kg == null
        ? `Kaydedildi — ${miktar} ${olcuBirimi} olarak. Bu ürünün kilogram karşılığı tanımlı değil, adet toplamına giriyor.`
        : `Kaydedildi (${kg} kg)`,
  };
}

export async function kayitSil(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const { hata } = await yazabilirMi();
  if (hata) return { hata };

  const id = m(formData, "kayit_id");
  if (!id) return { hata: "Kayıt seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("uretim_kayitlari").delete().eq("id", id);
  if (error) return { hata: "Silinemedi: " + error.message };

  revalidatePath(YOL);
  return { ok: "Kayıt silindi" };
}

/**
 * Seçilen kayıtları topluca siler.
 *
 * Kimlikler ekrandan geliyor; yani kullanıcı ne sildiğini görerek
 * seçiyor. "Filtredekilerin hepsi" seçeneği de aynı yoldan geçiyor —
 * sunucuya filtre değil, kimlik listesi gönderiliyor. Böylece ekranda
 * görülen liste ile silinen liste birebir aynı oluyor; filtreyi sunucuda
 * yeniden yorumlasaydım aradaki en küçük fark yanlış kayıt silerdi.
 *
 * Silinen her satır 0019'daki silme günlüğüne tam içeriğiyle düşer.
 */
export async function topluKayitSil(
  idler: string[],
): Promise<{ silinen: number; hata?: string }> {
  const { hata } = await yazabilirMi();
  if (hata) return { silinen: 0, hata };

  const temiz = [...new Set(idler.filter((x) => typeof x === "string" && x.trim()))];
  if (!temiz.length) return { silinen: 0, hata: "Silinecek kayıt seçilmedi." };

  const supabase = await createClient();

  // Parça parça: tek istekte binlerce kimlik göndermek isteği şişiriyor.
  let silinen = 0;
  for (let i = 0; i < temiz.length; i += 200) {
    const parca = temiz.slice(i, i + 200);
    const { data, error } = await supabase
      .from("uretim_kayitlari")
      .delete()
      .in("id", parca)
      .select("id");
    if (error) {
      return {
        silinen,
        hata: `${silinen} kayıt silindikten sonra durdu: ${error.message}`,
      };
    }
    silinen += data?.length ?? 0;
  }

  revalidatePath(YOL);
  return { silinen };
}

// ─── Ürün tanımı ──────────────────────────────────────────────────────────

export async function urunKaydet(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Ürün tanımlama yetkisi admin/genel müdürde." };
  }

  const kod = m(formData, "kod").toLocaleUpperCase("tr");
  const ad = m(formData, "ad");
  if (!kod) return { hata: "Ürün kodu zorunlu." };
  if (!ad) return { hata: "Ürün adı zorunlu." };

  const sayi = (a: string): number | null => {
    const v = m(formData, a).replace(",", ".");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const alanlar = {
    kod,
    ad,
    grup: m(formData, "grup"),
    ambalaj_tipi: m(formData, "ambalaj_tipi"),
    ambalaj_birimi: m(formData, "ambalaj_birimi") || "Adet",
    birim_agirlik_kg: sayi("birim_agirlik_kg"),
    koli_adedi: sayi("koli_adedi"),
    raf_omru_gun: sayi("raf_omru_gun"),
    aktif: formData.get("aktif") === "on",
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  const id = m(formData, "urun_id");
  const { error } = id
    ? await supabase.from("uretim_urunleri").update(alanlar).eq("id", id)
    : await supabase.from("uretim_urunleri").insert(alanlar);

  if (error) {
    if (/duplicate key/i.test(error.message)) return { hata: `"${kod}" kodu zaten kullanılıyor.` };
    return { hata: tabloHatasi(error.message) ?? "Kaydedilemedi: " + error.message };
  }

  revalidatePath(YOL);
  return {
    ok: alanlar.birim_agirlik_kg
      ? "Ürün kaydedildi"
      : "Ürün kaydedildi. Birim ağırlık girilmedi — bu ürünün üretimi kilogram yerine ADET olarak toplanacak (lavaş gibi ürünler için normaldir).",
  };
}

export async function urunSil(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile();
  if (profile.rol !== "admin" && profile.rol !== "genel_mudur") {
    return { hata: "Ürün silme yetkisi admin/genel müdürde." };
  }
  const id = m(formData, "urun_id");
  if (!id) return { hata: "Ürün seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("uretim_urunleri").delete().eq("id", id);
  if (error) {
    if (/foreign key/i.test(error.message)) {
      return { hata: "Bu ürünün üretim kayıtları var; silinemez. Bunun yerine pasife alın." };
    }
    return { hata: "Silinemedi: " + error.message };
  }

  revalidatePath(YOL);
  return { ok: "Ürün silindi" };
}

// ─── Excel'den toplu içe aktarma ──────────────────────────────────────────

export interface AktarSatir {
  tarih?: string;
  urun_kod?: string;
  urun_ad?: string;
  miktar?: string;
  olcu_birimi?: string;
  parti_no?: string;
  skt?: string;
  operator?: string;
  aciklama?: string;
}

/**
 * Excel'den okunan satırları kaydeder.
 *
 * Ürün EŞLEŞMEZSE satır atlanır ve gerekçesiyle rapor edilir. Sessizce
 * boş ürünle kaydetmek, sonradan kimsenin fark edemeyeceği bir veri
 * bozukluğu üretirdi.
 */
export async function topluAktar(
  satirlar: AktarSatir[],
): Promise<{ eklenen: number; atlanan: { satir: number; sebep: string }[]; hata?: string }> {
  const { profile, hata } = await yazabilirMi();
  if (hata) return { eklenen: 0, atlanan: [], hata };

  const supabase = await createClient();
  const { data: urunler, error: urunHata } = await supabase
    .from("uretim_urunleri")
    .select("*")
    .returns<Urun[]>();

  if (urunHata) {
    return { eklenen: 0, atlanan: [], hata: tabloHatasi(urunHata.message) ?? urunHata.message };
  }

  const kodIle = new Map((urunler ?? []).map((u) => [u.kod.toLocaleUpperCase("tr"), u]));
  const adIle = new Map((urunler ?? []).map((u) => [u.ad.toLocaleUpperCase("tr"), u]));

  const eklenecek: Record<string, unknown>[] = [];
  const atlanan: { satir: number; sebep: string }[] = [];

  satirlar.forEach((s, i) => {
    const satirNo = i + 2; // 1 = başlık satırı
    const urun =
      kodIle.get((s.urun_kod ?? "").toLocaleUpperCase("tr")) ??
      adIle.get((s.urun_ad ?? "").toLocaleUpperCase("tr"));

    if (!urun) {
      atlanan.push({
        satir: satirNo,
        sebep: `ürün tanımlı değil (${s.urun_kod || s.urun_ad || "boş"})`,
      });
      return;
    }

    const miktar = Number(String(s.miktar ?? "").replace(",", "."));
    if (!Number.isFinite(miktar) || miktar < 0) {
      atlanan.push({ satir: satirNo, sebep: `miktar okunamadı (${s.miktar ?? "boş"})` });
      return;
    }

    const tarih = (s.tarih ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
      atlanan.push({ satir: satirNo, sebep: `tarih okunamadı (${s.tarih ?? "boş"})` });
      return;
    }

    const olcu = (OLCU_BIRIMLERI as readonly string[]).includes(s.olcu_birimi ?? "")
      ? s.olcu_birimi!
      : (urun.ambalaj_birimi || "Adet");

    eklenecek.push({
      tarih,
      urun_id: urun.id,
      urun_kod: urun.kod,
      urun_ad: urun.ad,
      urun_grup: urun.grup,
      ambalaj_tipi: urun.ambalaj_tipi,
      miktar,
      olcu_birimi: olcu,
      kg_karsiligi: kilogramaCevir(miktar, olcu, urun),
      parti_no: s.parti_no ?? "",
      skt: /^\d{4}-\d{2}-\d{2}$/.test((s.skt ?? "").slice(0, 10)) ? s.skt!.slice(0, 10) : null,
      operator: s.operator ?? "",
      aciklama: s.aciklama ?? "",
      olusturan_id: profile.id,
    });
  });

  if (!eklenecek.length) {
    revalidatePath(YOL);
    return { eklenen: 0, atlanan };
  }

  const { error } = await supabase.from("uretim_kayitlari").insert(eklenecek);
  if (error) return { eklenen: 0, atlanan, hata: "Kaydedilemedi: " + error.message };

  revalidatePath(YOL);
  return { eklenen: eklenecek.length, atlanan };
}
