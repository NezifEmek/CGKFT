"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { GonderimYontemi } from "@/lib/toplanti";

type Sonuc = { hata?: string; ok?: string };

const YOL = "/toplantilar";

async function raportorMu() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("toplanti_ayarlari")
    .select("raportor_id")
    .eq("id", 1)
    .maybeSingle<{ raportor_id: string | null }>();
  const yetkili =
    profile.rol === "admin" ||
    profile.rol === "genel_mudur" ||
    (data?.raportor_id && data.raportor_id === profile.id);
  return yetkili ? profile : null;
}

async function genelMudurMu() {
  const profile = await requireProfile();
  return profile.rol === "admin" || profile.rol === "genel_mudur" ? profile : null;
}

const metin = (f: FormData, a: string) => String(f.get(a) ?? "").trim();
const tarihAl = (f: FormData, a: string) => {
  const v = metin(f, a);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};

// ─── Toplantı ──────────────────────────────────────────────────────────────

export async function toplantiOlustur(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await raportorMu();
  if (!profile) return { hata: "Toplantı açma yetkisi raportör, genel müdür ve adminde." };

  const tarih = tarihAl(formData, "tarih");
  if (!tarih) return { hata: "Geçerli bir toplantı tarihi seçin." };

  const supabase = await createClient();
  const { data: son } = await supabase
    .from("toplantilar")
    .select("no")
    .order("no", { ascending: false })
    .limit(1);
  const yeniNo = (son?.[0]?.no ?? 0) + 1;

  const { data: ayar } = await supabase
    .from("toplanti_ayarlari")
    .select("katilimcilar")
    .eq("id", 1)
    .maybeSingle<{ katilimcilar: string[] }>();

  const { error } = await supabase.from("toplantilar").insert({
    no: yeniNo,
    tarih,
    katilimcilar: ayar?.katilimcilar ?? [],
  });
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return { hata: "Tablolar yok — 0006_toplanti.sql çalıştırılmalı." };
    }
    return { hata: "Toplantı açılamadı: " + error.message };
  }

  revalidatePath(YOL);
  return { ok: `${yeniNo}. toplantı açıldı` };
}

/**
 * Gündemi "gönderir". Bugün e-posta yok: gönderim damgası atılır, metin
 * ekrandan kopyalanır/indirilir. E-posta eklendiğinde yalnızca yöntem
 * "eposta" olarak kaydedilecek ve burada gönderim çağrısı yapılacak.
 */
export async function gundemGonder(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await raportorMu();
  if (!profile) return { hata: "Bu işlem için raportör yetkisi gerekir." };

  const id = metin(formData, "toplanti_id");
  if (!id) return { hata: "Toplantı seçili değil." };

  const yontem: GonderimYontemi = "panel";
  const supabase = await createClient();
  const { error } = await supabase
    .from("toplantilar")
    .update({
      durum: "gundem_gonderildi",
      gundem_gonderildi_at: new Date().toISOString(),
      gundem_gonderim_yontemi: yontem,
    })
    .eq("id", id);
  if (error) return { hata: "İşlenemedi: " + error.message };

  revalidatePath(YOL);
  return { ok: "Gündem paylaşıldı olarak işaretlendi" };
}

export async function toplantiyiBitir(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await raportorMu();
  if (!profile) return { hata: "Bu işlem için raportör yetkisi gerekir." };

  const id = metin(formData, "toplanti_id");
  if (!id) return { hata: "Toplantı seçili değil." };

  const supabase = await createClient();
  const { data: t } = await supabase
    .from("toplantilar")
    .select("no, tarih")
    .eq("id", id)
    .maybeSingle<{ no: number; tarih: string }>();
  if (!t) return { hata: "Toplantı bulunamadı." };

  const { error } = await supabase
    .from("toplantilar")
    .update({
      durum: "tamamlandi",
      genel_not: metin(formData, "genel_not"),
      tamamlayan_id: profile.id,
      tamamlandi_at: new Date().toISOString(),
      sonuc_gonderildi_at: new Date().toISOString(),
      sonuc_gonderim_yontemi: "panel",
    })
    .eq("id", id);
  if (error) return { hata: "Bitirilemedi: " + error.message };

  // Toplantı bitince sıradaki otomatik açılır — gündem birikmeye başlasın.
  const sonraki = new Date(t.tarih + "T00:00:00");
  sonraki.setDate(sonraki.getDate() + 7);
  const { data: ayar } = await supabase
    .from("toplanti_ayarlari").select("katilimcilar").eq("id", 1)
    .maybeSingle<{ katilimcilar: string[] }>();
  await supabase.from("toplantilar").insert({
    no: t.no + 1,
    tarih: sonraki.toISOString().slice(0, 10),
    katilimcilar: ayar?.katilimcilar ?? [],
  });

  revalidatePath(YOL);
  return { ok: `${t.no}. toplantı kapatıldı, ${t.no + 1}. toplantı açıldı` };
}

// ─── Gündem ────────────────────────────────────────────────────────────────

export async function gundemEkle(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile(); // gündemi HERKES ekleyebilir
  const toplantiId = metin(formData, "toplanti_id");
  const baslik = metin(formData, "baslik");
  if (!toplantiId) return { hata: "Toplantı seçili değil." };
  if (!baslik) return { hata: "Gündem başlığı boş olamaz." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("toplanti_gundem")
    .select("*", { count: "exact", head: true })
    .eq("toplanti_id", toplantiId);

  const { error } = await supabase.from("toplanti_gundem").insert({
    toplanti_id: toplantiId,
    sira: (count ?? 0) + 1,
    baslik,
    aciklama: metin(formData, "aciklama"),
    ekleyen_id: profile.id,
  });
  if (error) return { hata: "Eklenemedi: " + error.message };

  revalidatePath(YOL);
  return { ok: "Gündem maddesi eklendi" };
}

export async function gundemSil(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  await requireProfile();
  const id = metin(formData, "gundem_id");
  if (!id) return { hata: "Madde seçili değil." };
  const supabase = await createClient();
  // RLS: yalnızca ekleyen kişi veya raportör silebilir.
  const { error } = await supabase.from("toplanti_gundem").delete().eq("id", id);
  if (error) return { hata: "Silinemedi: " + error.message };
  revalidatePath(YOL);
  return { ok: "Gündem maddesi silindi" };
}

/** Toplantı sırasında not ve karar — yalnızca raportör. */
export async function gundemNotKaydet(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await raportorMu();
  if (!profile) return { hata: "Not ve kararı yalnızca raportör yazabilir." };
  const id = metin(formData, "gundem_id");
  if (!id) return { hata: "Madde seçili değil." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("toplanti_gundem")
    .update({ toplanti_notu: metin(formData, "toplanti_notu"), karar: metin(formData, "karar") })
    .eq("id", id);
  if (error) return { hata: "Kaydedilemedi: " + error.message };

  revalidatePath(YOL);
  return { ok: "Not ve karar kaydedildi" };
}

// ─── Görevler ──────────────────────────────────────────────────────────────

export async function gorevAta(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await raportorMu();
  if (!profile) return { hata: "Görev atamayı yalnızca raportör yapar." };

  const toplantiId = metin(formData, "toplanti_id");
  const baslik = metin(formData, "baslik");
  const atanan = metin(formData, "atanan_id");
  const termin = tarihAl(formData, "termin");
  const gundemId = metin(formData, "gundem_id");

  if (!toplantiId || !baslik) return { hata: "Görev başlığı zorunlu." };
  if (!atanan) return { hata: "Görev bir kişiye atanmalı." };
  if (!termin) return { hata: "Geçerli bir tamamlama tarihi girin." };

  const supabase = await createClient();
  const { error } = await supabase.from("toplanti_gorevleri").insert({
    toplanti_id: toplantiId,
    gundem_id: gundemId || null,
    baslik,
    aciklama: metin(formData, "aciklama"),
    atanan_id: atanan,
    termin,
  });
  if (error) return { hata: "Görev atanamadı: " + error.message };

  revalidatePath(YOL);
  return { ok: "Görev atandı" };
}

/** Atanan kişi kendi görevini tamamlar. Termin BURADAN değişmez. */
export async function gorevDurumGuncelle(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile();
  const id = metin(formData, "gorev_id");
  const durum = metin(formData, "durum");
  if (!id) return { hata: "Görev seçili değil." };
  if (!["acik", "tamamlandi", "iptal"].includes(durum)) return { hata: "Geçersiz durum." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("toplanti_gorevleri")
    .update({
      durum,
      tamamlanma_tarihi: durum === "tamamlandi" ? new Date().toISOString().slice(0, 10) : null,
      sonuc_notu: metin(formData, "sonuc_notu"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { hata: "Güncellenemedi: " + error.message };

  revalidatePath(YOL);
  return { ok: durum === "tamamlandi" ? "Görev tamamlandı olarak işaretlendi" : "Görev güncellendi" };
}

// ─── Erteleme (genel müdür onayına tabi) ───────────────────────────────────

export async function ertelemeTalep(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await requireProfile();
  const gorevId = metin(formData, "gorev_id");
  const yeniTermin = tarihAl(formData, "yeni_termin");
  const gerekce = metin(formData, "gerekce");

  if (!gorevId) return { hata: "Görev seçili değil." };
  if (!yeniTermin) return { hata: "Geçerli bir yeni tarih girin." };
  if (!gerekce) return { hata: "Erteleme gerekçesi zorunlu." };

  const supabase = await createClient();
  const { data: g } = await supabase
    .from("toplanti_gorevleri").select("termin").eq("id", gorevId)
    .maybeSingle<{ termin: string }>();
  if (!g) return { hata: "Görev bulunamadı." };
  if (yeniTermin <= g.termin) return { hata: "Yeni tarih mevcut terminden sonra olmalı." };

  const { data: bekleyen } = await supabase
    .from("gorev_ertelemeleri").select("id")
    .eq("gorev_id", gorevId).eq("onay_durumu", "bekliyor").maybeSingle();
  if (bekleyen) return { hata: "Bu görev için zaten onay bekleyen bir erteleme var." };

  const { error } = await supabase.from("gorev_ertelemeleri").insert({
    gorev_id: gorevId,
    eski_termin: g.termin,
    yeni_termin: yeniTermin,
    gerekce,
    talep_eden_id: profile.id,
  });
  if (error) return { hata: "Talep açılamadı: " + error.message };

  revalidatePath(YOL);
  return { ok: "Erteleme talebi genel müdür onayına gönderildi" };
}

export async function ertelemeKarar(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await genelMudurMu();
  if (!profile) return { hata: "Erteleme kararını yalnızca genel müdür verebilir." };

  const id = metin(formData, "erteleme_id");
  const karar = metin(formData, "karar");
  if (!id) return { hata: "Talep seçili değil." };
  if (!["onaylandi", "reddedildi"].includes(karar)) return { hata: "Geçersiz karar." };

  const supabase = await createClient();
  const { data: e } = await supabase
    .from("gorev_ertelemeleri").select("gorev_id, yeni_termin, onay_durumu").eq("id", id)
    .maybeSingle<{ gorev_id: string; yeni_termin: string; onay_durumu: string }>();
  if (!e) return { hata: "Talep bulunamadı." };
  if (e.onay_durumu !== "bekliyor") return { hata: "Bu talep zaten karara bağlanmış." };

  const { error } = await supabase
    .from("gorev_ertelemeleri")
    .update({
      onay_durumu: karar,
      karar_veren_id: profile.id,
      karar_at: new Date().toISOString(),
      karar_notu: metin(formData, "karar_notu"),
    })
    .eq("id", id);
  if (error) return { hata: "Karar işlenemedi: " + error.message };

  // Termin YALNIZCA onaydan sonra değişir.
  if (karar === "onaylandi") {
    await supabase
      .from("toplanti_gorevleri")
      .update({ termin: e.yeni_termin, updated_at: new Date().toISOString() })
      .eq("id", e.gorev_id);
  }

  revalidatePath(YOL);
  return { ok: karar === "onaylandi" ? "Erteleme onaylandı, termin güncellendi" : "Erteleme reddedildi" };
}

// ─── Ayarlar ───────────────────────────────────────────────────────────────

export async function ayarKaydet(_o: Sonuc | null, formData: FormData): Promise<Sonuc> {
  const profile = await genelMudurMu();
  if (!profile) return { hata: "Ayarları admin veya genel müdür değiştirebilir." };

  const raportor = metin(formData, "raportor_id");
  const katilimcilar = formData.getAll("katilimci").map((x) => String(x)).filter(Boolean);

  const supabase = await createClient();
  const { error } = await supabase
    .from("toplanti_ayarlari")
    .update({
      raportor_id: raportor || null,
      katilimcilar,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { hata: "Kaydedilemedi: " + error.message };

  revalidatePath(YOL);
  return { ok: "Toplantı ayarları kaydedildi" };
}
