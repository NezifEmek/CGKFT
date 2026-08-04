"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  TUM_SORULAR,
  DENETIM_TURLERI,
  skorHesapla,
  grupBul,
} from "@/lib/denetim-sorulari";
import { hataMesaji } from "@/lib/hata";

export async function denetimKaydet(
  _onceki: { hata?: string; ok?: boolean } | null,
  formData: FormData,
) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const subeId = String(formData.get("sube_id") ?? "").trim();
  if (!subeId) return { hata: "Şube seçilmedi." };

  const tarih = String(formData.get("tarih") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { hata: "Geçerli bir tarih seçin." };

  const turHam = String(formData.get("tur") ?? "");
  const tur = (DENETIM_TURLERI as readonly string[]).includes(turHam) ? turHam : "Periyodik";

  const denetleyen = String(formData.get("denetleyen") ?? "").trim();
  const notlar = String(formData.get("notlar") ?? "").trim();

  // Cevapları oku — yalnızca bilinen soru id'leri ve 1–3 aralığı.
  const cevaplar: Record<string, number> = {};
  for (const soru of TUM_SORULAR) {
    const ham = formData.get(`soru_${soru.id}`);
    if (ham == null || ham === "") continue;
    const p = Number(ham);
    if (p === 1 || p === 2 || p === 3) cevaplar[soru.id] = p;
  }

  if (!Object.keys(cevaplar).length) {
    return { hata: "En az bir soruyu cevaplayın." };
  }

  const skor = skorHesapla(cevaplar);
  const grup = grupBul(skor.puan100);

  const { error } = await supabase.from("denetimler").insert({
    sube_id: subeId,
    denetmen_id: profile.id,
    tarih,
    puan: skor.puan100,
    notlar,
    detay: {
      cevaplar,
      bolumPuanlar: skor.bolumPuanlar,
      toplam: skor.toplam,
      cevaplanmis: skor.cevaplanmis,
      soruSayisi: TUM_SORULAR.length,
      tur,
      denetleyen,
      grup: grup.ad,
    },
  });

  if (error) return { hata: hataMesaji(error.message, "Denetim kaydedilemedi") };

  revalidatePath("/sube-denetimi");
  revalidatePath("/yetkili-analizi");
  return { hata: undefined, ok: true };
}

export async function denetimSil(
  _onceki: { hata?: string; ok?: boolean } | null,
  formData: FormData,
) {
  await requireProfile();
  const denetimId = String(formData.get("denetim_id") ?? "").trim();
  if (!denetimId) return { hata: "Kayıt seçili değil." };

  const supabase = await createClient();
  // RLS: kullanıcı yalnızca yetkili olduğu kayıtları silebilir.
  const { error } = await supabase.from("denetimler").delete().eq("id", denetimId);
  if (error) return { hata: hataMesaji(error.message, "Silinemedi") };

  revalidatePath("/sube-denetimi");
  revalidatePath("/yetkili-analizi");
  return { hata: undefined, ok: true };
}
