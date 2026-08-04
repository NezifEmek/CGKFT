"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { GELIR_ALANLARI, GIDER_ALANLARI, AYLAR_12 } from "@/lib/merkez-gg";
import { hataMesaji } from "@/lib/hata";

type Sonuc = { hata?: string; ok?: string };

const SAYI_ALANLARI = [...GELIR_ALANLARI, ...GIDER_ALANLARI].map((a) => a.key);

async function yazabilirMi() {
  const profile = await requireProfile();
  if (profile.rol === "denetmen") return null;
  return profile;
}

function sayi(formData: FormData, ad: string): number {
  const ham = String(formData.get(ad) ?? "").trim().replace(",", ".");
  if (!ham) return 0;
  const n = Number(ham);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Tek günün kaydı — aynı şube+tarih varsa üzerine yazar (unique kısıt). */
export async function gunlukKaydet(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await yazabilirMi();
  if (!profile) return { hata: "Gelir-gider girme yetkiniz yok." };

  const subeId = String(formData.get("sube_id") ?? "").trim();
  if (!subeId) return { hata: "Şube seçilmedi." };

  const tarih = String(formData.get("tarih") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { hata: "Geçerli bir tarih seçin." };

  const satir: Record<string, unknown> = {
    sube_id: subeId,
    tarih,
    kaynak: "elle",
    guncelleyen_id: profile.id,
    updated_at: new Date().toISOString(),
  };
  for (const k of SAYI_ALANLARI) satir[k] = sayi(formData, k);

  const supabase = await createClient();
  const { error } = await supabase
    .from("merkez_gg_gunluk")
    .upsert(satir, { onConflict: "sube_id,tarih" });

  if (error) return { hata: hataMesaji(error.message, "Kaydedilemedi") };

  revalidatePath("/merkez-gelir-gider");
  return { ok: `${tarih} kaydedildi` };
}

export async function gunlukSil(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await yazabilirMi();
  if (!profile) return { hata: "Silme yetkiniz yok." };

  const id = String(formData.get("kayit_id") ?? "").trim();
  if (!id) return { hata: "Kayıt seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("merkez_gg_gunluk").delete().eq("id", id);
  if (error) return { hata: hataMesaji(error.message, "Silinemedi") };

  revalidatePath("/merkez-gelir-gider");
  return { ok: "Gün kaydı silindi" };
}

export async function kalemKaydet(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await yazabilirMi();
  if (!profile) return { hata: "Kalem girme yetkiniz yok." };

  const subeId = String(formData.get("sube_id") ?? "").trim();
  const yil = Number(formData.get("yil"));
  const ay = String(formData.get("ay") ?? "").trim();
  const urun = String(formData.get("urun") ?? "").trim();

  if (!subeId) return { hata: "Şube seçilmedi." };
  if (!Number.isInteger(yil) || yil < 2000 || yil > 2100) return { hata: "Geçerli bir yıl girin." };
  if (!(AYLAR_12 as readonly string[]).includes(ay)) return { hata: "Geçerli bir ay seçin." };
  if (!urun) return { hata: "Ürün/kalem adı boş olamaz." };

  const supabase = await createClient();
  const { error } = await supabase.from("merkez_gg_kalem").insert({
    sube_id: subeId,
    yil,
    ay,
    urun,
    adet: sayi(formData, "adet"),
    tutar: sayi(formData, "tutar"),
    kaynak: "elle",
    guncelleyen_id: profile.id,
  });

  if (error) return { hata: hataMesaji(error.message, "Kaydedilemedi") };

  revalidatePath("/merkez-gelir-gider");
  return { ok: `"${urun}" kalemi eklendi` };
}

export async function kalemSil(_onceki: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await yazabilirMi();
  if (!profile) return { hata: "Silme yetkiniz yok." };

  const id = String(formData.get("kalem_id") ?? "").trim();
  if (!id) return { hata: "Kalem seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase.from("merkez_gg_kalem").delete().eq("id", id);
  if (error) return { hata: hataMesaji(error.message, "Silinemedi") };

  revalidatePath("/merkez-gelir-gider");
  return { ok: "Kalem silindi" };
}

export interface IceAktarSayfasi {
  subeId: string;
  yil: number;
  ay: string;
  gunluk: {
    tarih: string;
    nakit: number;
    kredi_karti: number;
    ticket: number;
    yemek_sepeti: number;
    ayran: number;
    yemek: number;
    genel_masraf: number;
  }[];
  kalemler: { urun: string; adet: number; tutar: number }[];
}

/**
 * Excel'den gelen sayfaları yazar.
 *
 * Eski panel, içe aktarmada ilgili şube+ay bloğunun tamamını silip yeniden
 * yazıyordu; elle girilmiş bir gün varsa kayboluyordu. Burada günler
 * (sube_id, tarih) üzerinden upsert edilir: Excel'de olmayan bir güne elle
 * girilen kayıt yerinde kalır. Kalemler ise aynı şube+dönem için Excel
 * kaynaklı olanlarla değiştirilir — elle eklenen kalemlere dokunulmaz.
 */
export async function excelIceAktar(sayfalar: IceAktarSayfasi[]): Promise<
  Sonuc & { gunSayisi?: number; kalemSayisi?: number; subeAySayisi?: number }
> {
  const profile = await yazabilirMi();
  if (!profile) return { hata: "İçe aktarma yetkiniz yok." };
  if (!sayfalar.length) return { hata: "Aktarılacak sayfa yok." };

  const supabase = await createClient();
  const simdi = new Date().toISOString();
  let gunSayisi = 0;
  let kalemSayisi = 0;

  for (const s of sayfalar) {
    if (!s.subeId || !s.gunluk.length) continue;

    const satirlar = s.gunluk.map((g) => ({
      sube_id: s.subeId,
      tarih: g.tarih,
      nakit: g.nakit,
      kredi_karti: g.kredi_karti,
      ticket: g.ticket,
      yemek_sepeti: g.yemek_sepeti,
      ayran: g.ayran,
      yemek: g.yemek,
      genel_masraf: g.genel_masraf,
      kaynak: "excel" as const,
      guncelleyen_id: profile.id,
      updated_at: simdi,
    }));

    const { error: gunHata } = await supabase
      .from("merkez_gg_gunluk")
      .upsert(satirlar, { onConflict: "sube_id,tarih" });
    if (gunHata) return { hata: `${s.ay} günlük kayıtları yazılamadı. ${hataMesaji(gunHata.message, "Yazılamadı")}` };
    gunSayisi += satirlar.length;

    if (s.kalemler.length) {
      // Yalnızca Excel kaynaklı kalemleri tazele; elle eklenenler korunur.
      await supabase
        .from("merkez_gg_kalem")
        .delete()
        .eq("sube_id", s.subeId)
        .eq("yil", s.yil)
        .eq("ay", s.ay)
        .eq("kaynak", "excel");

      const { error: kalemHata } = await supabase.from("merkez_gg_kalem").insert(
        s.kalemler.map((k) => ({
          sube_id: s.subeId,
          yil: s.yil,
          ay: s.ay,
          urun: k.urun,
          adet: k.adet,
          tutar: k.tutar,
          kaynak: "excel" as const,
          guncelleyen_id: profile.id,
        })),
      );
      if (kalemHata) return { hata: `${s.ay} kalemleri yazılamadı. ${hataMesaji(kalemHata.message, "Yazılamadı")}` };
      kalemSayisi += s.kalemler.length;
    }
  }

  revalidatePath("/merkez-gelir-gider");
  return {
    ok: `İçe aktarıldı: ${gunSayisi} gün, ${kalemSayisi} kalem`,
    gunSayisi,
    kalemSayisi,
    subeAySayisi: sayfalar.filter((s) => s.subeId && s.gunluk.length).length,
  };
}
