"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { SKOR_TURLERI } from "@/lib/skor";

export async function skorKaydet(
  _onceki: { hata?: string; ok?: string } | null,
  formData: FormData,
) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const subeId = String(formData.get("sube_id") ?? "").trim();
  if (!subeId) return { hata: "Şube seçilmedi." };

  const tarih = String(formData.get("tarih") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { hata: "Geçerli bir tarih seçin." };

  const turHam = String(formData.get("tur") ?? "");
  const tur = (SKOR_TURLERI as readonly string[]).includes(turHam) ? turHam : "Gizli Müşteri";

  const puanHam = String(formData.get("puan") ?? "").replace(",", ".");
  const puan = Number(puanHam);
  if (!Number.isFinite(puan) || puan < 0 || puan > 100) {
    return { hata: "Geçerli bir puan girin (0 – 100)." };
  }
  // Eski panelde olduğu gibi tek ondalığa yuvarla.
  const yuvarlanmis = Math.round(puan * 10) / 10;

  const { error } = await supabase.from("skorlar").insert({
    sube_id: subeId,
    olusturan_id: profile.id,
    tarih,
    puan: yuvarlanmis,
    detay: { tur },
  });

  if (error) return { hata: "Skor kaydedilemedi: " + error.message };

  revalidatePath("/hizli-skor");
  return { hata: undefined, ok: `${tur} · ${yuvarlanmis}/100 kaydedildi` };
}

export async function skorSil(
  _onceki: { hata?: string; ok?: string } | null,
  formData: FormData,
) {
  await requireProfile();
  const skorId = String(formData.get("skor_id") ?? "").trim();
  if (!skorId) return { hata: "Kayıt seçili değil." };

  const supabase = await createClient();
  // RLS: kullanıcı yalnızca yetkili olduğu kayıtları silebilir.
  const { error } = await supabase.from("skorlar").delete().eq("id", skorId);
  if (error) return { hata: "Silinemedi: " + error.message };

  revalidatePath("/hizli-skor");
  return { hata: undefined, ok: "Kayıt silindi" };
}
