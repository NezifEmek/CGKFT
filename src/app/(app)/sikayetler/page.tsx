import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Profile } from "@/types/database";
import type { Sikayet } from "@/lib/sikayet";
import { SikayetArayuz, type Hareket } from "./sikayet-arayuz";

interface SubeKisa {
  id: string;
  ad: string;
  aktif: boolean;
}

export default async function SikayetlerSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const bugun = new Date().toISOString().slice(0, 10);

  let tabloYok = false;

  const [sikayetler, hareketler, atamalar, subeler, { data: profiller }] = await Promise.all([
    tumSatirlariGetir<Sikayet>((f, t) =>
      supabase
        .from("sikayetler")
        .select("*")
        .order("basvuru_tarihi", { ascending: false })
        .range(f, t)
        .returns<Sikayet[]>(),
    ).catch(() => {
      tabloYok = true;
      return [] as Sikayet[];
    }),
    tumSatirlariGetir<Hareket>((f, t) =>
      supabase.from("sikayet_hareketleri").select("*").range(f, t).returns<Hareket[]>(),
    ).catch(() => [] as Hareket[]),
    tumSatirlariGetir<{ sikayet_id: string; profil_id: string }>((f, t) =>
      supabase
        .from("sikayet_atamalari")
        .select("sikayet_id, profil_id")
        .range(f, t)
        .returns<{ sikayet_id: string; profil_id: string }[]>(),
    ).catch(() => [] as { sikayet_id: string; profil_id: string }[]),
    tumSatirlariGetir<SubeKisa>((f, t) =>
      supabase.from("subeler").select("id, ad, aktif").range(f, t).returns<SubeKisa[]>(),
    ),
    supabase.from("profiles").select("id, ad_soyad").returns<Profile[]>(),
  ]);

  const yonetimMi = profile.rol === "admin" || profile.rol === "genel_mudur";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Şikayet Yönetimi</h1>
        <p className="text-sm text-neutral-500">
          Müşteri, tüketici, franchise, tedarikçi ve personelden gelen tüm şikayet ve geri
          bildirimlerin kaydı, takibi ve raporlanması. Durum her değiştiğinde tarih ve kullanıcı
          bilgisi kendiliğinden geçmişe düşer.
        </p>
      </div>

      <SikayetArayuz
        sikayetler={sikayetler}
        hareketler={hareketler}
        atamalar={atamalar}
        subeler={subeler
          .filter((s) => s.aktif !== false)
          .map((s) => ({ id: s.id, ad: s.ad }))
          .sort((a, b) => a.ad.localeCompare(b.ad, "tr"))}
        kisiler={(profiller ?? [])
          .map((p) => ({ id: p.id, ad_soyad: p.ad_soyad || "(adsız)" }))
          .sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr"))}
        benId={profile.id}
        yonetimMi={yonetimMi}
        bugun={bugun}
        tabloYok={tabloYok}
      />
    </div>
  );
}
