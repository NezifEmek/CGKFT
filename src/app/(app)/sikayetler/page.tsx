import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir, sonuclaGetir } from "@/lib/supabase/fetch-all";
import type { Profile } from "@/types/database";
import type { Sikayet } from "@/lib/sikayet";
import type { Dosya } from "@/lib/dosya";
import { yetkiCoz } from "@/lib/sikayet-rol";
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

  const [sikayetSonuc, hareketler, atamalar, dosyalar, subeler, { data: profiller }] = await Promise.all([
    sonuclaGetir<Sikayet>(() =>
      tumSatirlariGetir<Sikayet>((f, t) =>
        supabase
          .from("sikayetler")
          .select("*")
          .order("basvuru_tarihi", { ascending: false })
          .range(f, t)
          .returns<Sikayet[]>(),
      ),
    ),
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
    tumSatirlariGetir<Dosya>((f, t) =>
      supabase
        .from("dosyalar")
        .select("*")
        .eq("kapsam", "sikayet")
        .order("created_at", { ascending: false })
        .range(f, t)
        .returns<Dosya[]>(),
    ).catch(() => [] as Dosya[]),
    tumSatirlariGetir<SubeKisa>((f, t) =>
      supabase.from("subeler").select("id, ad, aktif").range(f, t).returns<SubeKisa[]>(),
    ),
    supabase.from("profiles").select("id, ad_soyad").returns<Profile[]>(),
  ]);

  // Şikayet yetkileri kişinin şikayet rolünden geliyor (0016); rol boşsa
  // genel rolünden türetiliyor.
  const yetki = yetkiCoz(profile.sikayet_rolu, profile.rol);

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
        sikayetler={sikayetSonuc.veri}
        hareketler={hareketler}
        atamalar={atamalar}
        dosyalar={dosyalar}
        subeler={subeler
          .filter((s) => s.aktif !== false)
          .map((s) => ({ id: s.id, ad: s.ad }))
          .sort((a, b) => a.ad.localeCompare(b.ad, "tr"))}
        kisiler={(profiller ?? [])
          .map((p) => ({ id: p.id, ad_soyad: p.ad_soyad || "(adsız)" }))
          .sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr"))}
        benId={profile.id}
        yetki={yetki}
        bugun={bugun}
        tabloYok={Boolean(sikayetSonuc.hata)}
      />
    </div>
  );
}
