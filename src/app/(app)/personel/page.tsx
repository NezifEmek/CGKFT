import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir, sonuclaGetir } from "@/lib/supabase/fetch-all";
import { pozisyonlariNormalize } from "@/lib/dokuman";
import type { Profile } from "@/types/database";
import type { Personel, Atama, PozisyonKisa } from "@/lib/kadro";
import { PersonelArayuz } from "./personel-arayuz";

export default async function PersonelSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const bugun = new Date().toISOString().slice(0, 10);

  const [personelSonuc, atamalar, { data: dokData }, { data: profiller }] = await Promise.all([
    sonuclaGetir<Personel>(() =>
      tumSatirlariGetir<Personel>((f, t) =>
        supabase.from("personeller").select("*").order("ad_soyad").range(f, t).returns<Personel[]>(),
      ),
    ),
    tumSatirlariGetir<Atama>((f, t) =>
      supabase.from("pozisyon_atamalari").select("*").range(f, t).returns<Atama[]>(),
    ).catch(() => [] as Atama[]),
    supabase
      .from("dokuman_ayarlari")
      .select("pozisyonlar")
      .eq("id", 1)
      .maybeSingle<{ pozisyonlar: unknown }>(),
    supabase.from("profil_dizini").select("id, ad_soyad").order("ad_soyad").returns<Profile[]>(),
  ]);

  // Görev tanımının "içeriği dolu mu" sorusu: amaç, günlük görevler ve
  // sorumluluklardan en az biri yazılıysa dolu sayılıyor. Hiçbiri yoksa
  // yeni açılmış ama doldurulmamış demektir — uyarı üretir.
  const pozisyonlar: PozisyonKisa[] = pozisyonlariNormalize(dokData?.pozisyonlar).map((p) => ({
    id: p.id,
    unvan: p.unvan,
    adSoyad: p.adSoyad ?? "",
    doluMu: Boolean(
      (p.amac ?? "").trim() || (p.gorevlerGunluk ?? "").trim() || (p.sorumluluklar ?? "").trim(),
    ),
  }));

  const duzenlenebilir = profile.rol === "admin" || profile.rol === "genel_mudur";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Personel</h1>
        <p className="text-sm text-neutral-500">
          Şirket kadrosu ve görev atamaları. Adlar burada tek yerde tutulur; prim, organizasyon
          şeması ve raporlar buradan beslenir. Görevli değiştiğinde eski kayıtlar silinmez —
          geçmiş aylar o dönemin kadrosunu göstermeye devam eder.
        </p>
      </div>

      <PersonelArayuz
        personeller={personelSonuc.veri}
        atamalar={atamalar}
        pozisyonlar={pozisyonlar}
        profiller={(profiller ?? []).map((p) => ({
          id: p.id,
          ad_soyad: p.ad_soyad || "(adsız)",
        }))}
        bugun={bugun}
        duzenlenebilir={duzenlenebilir}
        tabloYok={Boolean(personelSonuc.hata)}
      />
    </div>
  );
}
