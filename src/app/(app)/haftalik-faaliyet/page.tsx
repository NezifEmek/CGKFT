import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir, sonuclaGetir } from "@/lib/supabase/fetch-all";
import { haftaKur, haftaBasi, haftaSecenekleri, gunEkle } from "@/lib/hafta";
import {
  haftalikFaaliyet,
  type FaaliyetKaynak,
  type DenetimSatir,
  type SkorSatir,
  type FranchiseSatir,
  type ToplantiSatir,
  type GorevSatir,
  type OneriSatir,
  type PlanSatir,
} from "@/lib/faaliyet";
import { gorunurPozisyonlar, asciiKatla } from "@/lib/organizasyon";
import { pozisyonlariNormalize } from "@/lib/dokuman";
import type { Profile } from "@/types/database";
import { FaaliyetArayuz } from "./faaliyet-arayuz";

interface SubeKisa {
  id: string;
  ad: string;
  aktif: boolean;
}

export default async function HaftalikFaaliyetSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const bugun = new Date().toISOString().slice(0, 10);
  const secilenHam = typeof sp.hafta === "string" ? sp.hafta : bugun;
  const hafta = haftaKur(haftaBasi(secilenHam));
  const haftalar = haftaSecenekleri(bugun, 12);
  const gecenHafta = gunEkle(hafta.baslangic, -7);

  // Faaliyetler haftaya göre süzülüyor ama sorgular geniş tutuluyor:
  // 1000 satır sınırına takılmamak için hepsi sayfalama ile okunuyor.
  const araligBas = gunEkle(hafta.baslangic, -1);
  const araligBit = gunEkle(hafta.bitis, 1);


  const [
    { data: profiller },
    subeler,
    denetimler,
    skorlar,
    franchise,
    toplantilar,
    gorevler,
    oneriler,
    planSonuc,
    { data: dokData },
  ] = await Promise.all([
    supabase.from("profiles").select("id, ad_soyad, rol, pozisyon_id").returns<Profile[]>(),
    tumSatirlariGetir<SubeKisa>((f, t) =>
      supabase.from("subeler").select("id, ad, aktif").range(f, t).returns<SubeKisa[]>(),
    ),
    tumSatirlariGetir<DenetimSatir>((f, t) =>
      supabase
        .from("denetimler")
        .select("id, sube_id, denetmen_id, tarih, puan")
        .gte("tarih", araligBas)
        .lte("tarih", araligBit)
        .range(f, t)
        .returns<DenetimSatir[]>(),
    ).catch(() => [] as DenetimSatir[]),
    tumSatirlariGetir<SkorSatir>((f, t) =>
      supabase
        .from("skorlar")
        .select("id, sube_id, olusturan_id, tarih, puan")
        .gte("tarih", araligBas)
        .lte("tarih", araligBit)
        .range(f, t)
        .returns<SkorSatir[]>(),
    ).catch(() => [] as SkorSatir[]),
    tumSatirlariGetir<FranchiseSatir>((f, t) =>
      supabase
        .from("franchise_basvurulari")
        .select("id, basvuru_no, isim, sirket_sorumlusu, sorumlu_arama_tarihi, memnuniyet_arama_tarihi, son_durum")
        .range(f, t)
        .returns<FranchiseSatir[]>(),
    ).catch(() => [] as FranchiseSatir[]),
    tumSatirlariGetir<ToplantiSatir>((f, t) =>
      supabase
        .from("toplantilar")
        .select("id, no, tarih, katilimcilar")
        .range(f, t)
        .returns<ToplantiSatir[]>(),
    ).catch(() => [] as ToplantiSatir[]),
    tumSatirlariGetir<GorevSatir>((f, t) =>
      supabase
        .from("toplanti_gorevleri")
        .select("id, baslik, atanan_id, termin, durum, tamamlanma_tarihi, created_at")
        .range(f, t)
        .returns<GorevSatir[]>(),
    ).catch(() => [] as GorevSatir[]),
    tumSatirlariGetir<OneriSatir>((f, t) =>
      supabase
        .from("oneriler")
        .select("id, baslik, ekleyen_id, created_at")
        .range(f, t)
        .returns<OneriSatir[]>(),
    ).catch(() => [] as OneriSatir[]),
    sonuclaGetir<PlanSatir>(() =>
      tumSatirlariGetir<PlanSatir>((f, t) =>
        supabase
          .from("haftalik_plan")
          .select("*")
          .eq("hafta", hafta.baslangic)
          .range(f, t)
          .returns<PlanSatir[]>(),
      ),
    ),
    supabase.from("dokuman_ayarlari").select("pozisyonlar").eq("id", 1).maybeSingle<{ pozisyonlar: unknown }>(),
  ]);

  // ─── Görünürlük: admin herkesi, diğerleri kendisi + astları ────────────
  const pozisyonlar = pozisyonlariNormalize(dokData?.pozisyonlar);
  const gorunurPoz = gorunurPozisyonlar(profile.rol, profile.pozisyon_id, pozisyonlar);
  const gorunurAdlar = gorunurPoz
    ? new Set(
        pozisyonlar
          .filter((p) => gorunurPoz.has(p.id))
          .map((p) => asciiKatla(p.adSoyad || ""))
          .filter(Boolean),
      )
    : null;

  const tumKisiler = (profiller ?? []).map((p) => ({ id: p.id, ad_soyad: p.ad_soyad || "" }));
  const kisiler = gorunurAdlar
    ? tumKisiler.filter(
        // Kendisi her hâlükârda görünür; pozisyonu eşleşmeyen kimse kaybolmasın diye
        // yalnızca ad eşleşmesi tutanlar süzülüyor.
        (k) => k.id === profile.id || gorunurAdlar.has(asciiKatla(k.ad_soyad)),
      )
    : tumKisiler;

  const kaynak: FaaliyetKaynak = {
    denetimler,
    skorlar,
    franchise,
    toplantilar,
    gorevler,
    oneriler,
    plan: planSonuc.veri,
    subeAdlari: new Map(subeler.map((s) => [s.id, s.ad])),
  };

  const faaliyetler = haftalikFaaliyet(hafta, kisiler, kaynak);

  const duzenleyebilir =
    profile.rol === "admin" || profile.rol === "genel_mudur" || profile.rol === "bolge_muduru";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Haftalık Faaliyet Raporu</h1>
        <p className="text-sm text-neutral-500">
          Kimin hangi hafta ne yaptığı. Faaliyetler ayrıca girilmez — denetim, hızlı skor,
          franchise araması, toplantı ve görev kayıtlarından kendiliğinden derlenir. Yalnızca{" "}
          <b>plan</b> elle girilir; planlanan şube o hafta denetlenmişse gerçekleşmiş sayılır.
        </p>
      </div>

      <FaaliyetArayuz
        hafta={hafta}
        haftalar={haftalar}
        kisiler={faaliyetler}
        subeler={subeler
          .filter((s) => s.aktif !== false)
          .map((s) => ({ id: s.id, ad: s.ad }))
          .sort((a, b) => a.ad.localeCompare(b.ad, "tr"))}
        benId={profile.id}
        duzenleyebilir={duzenleyebilir}
        gecenHafta={gecenHafta}
        tabloYok={Boolean(planSonuc.hata)}
      />
    </div>
  );
}
