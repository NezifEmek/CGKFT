import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir, sonuclaGetir } from "@/lib/supabase/fetch-all";
import type { Profile } from "@/types/database";
import type { Sikayet } from "@/lib/sikayet";
import type { Dosya } from "@/lib/dosya";
import { yetkiCoz } from "@/lib/sikayet-rol";
import { SikayetArayuz, type Hareket } from "./sikayet-arayuz";

/** Günlük Üretim ekranında tanımlı ürünler — şikayetteki ürün listesi buradan. */
interface UrunKisa {
  id: string;
  kod: string;
  ad: string;
  aktif: boolean;
}

interface SubeKisa {
  id: string;
  ad: string;
  aktif: boolean;
  /** Şube kodu (ör. M03-003SA) — şikayette kodu yazarak seçim için */
  kod: string | null;
  il: string | null;
  ilce: string | null;
}

export default async function SikayetlerSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const bugun = new Date().toISOString().slice(0, 10);

  const [
    sikayetSonuc, hareketler, atamalar, dosyalar, subeler, { data: profiller }, urunler,
  ] = await Promise.all([
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
      supabase.from("subeler").select("id, ad, aktif, kod, il, ilce").range(f, t).returns<SubeKisa[]>(),
    ),
    supabase.from("profiles").select("id, ad_soyad").returns<Profile[]>(),
    // Şikayetteki "Ürün" alanı artık serbest metin değil, Günlük Üretim
    // ekranında tanımlı ürünlerden seçiliyor (Nezif'in isteği). Tablo yoksa
    // ya da hiç ürün tanımlanmamışsa ekran serbest metne düşer.
    tumSatirlariGetir<UrunKisa>((f, t) =>
      supabase
        .from("uretim_urunleri")
        .select("id, kod, ad, aktif")
        .order("ad")
        .range(f, t)
        .returns<UrunKisa[]>(),
    ).catch(() => [] as UrunKisa[]),
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
        // Kapalı şubeler DE gönderiliyor: eski bir şikayet kapanmış şubeye
        // bağlıysa kaydı açtığınızda şube alanı boş görünmemeli. Seçici
        // kapalı olanı "(kapalı şube)" diye işaretler. Açıklar üstte.
        subeler={[...subeler].sort(
          (a, b) =>
            Number(b.aktif !== false) - Number(a.aktif !== false) ||
            (a.kod ?? "").localeCompare(b.kod ?? "", "tr") ||
            a.ad.localeCompare(b.ad, "tr"),
        )}
        kisiler={(profiller ?? [])
          .map((p) => ({ id: p.id, ad_soyad: p.ad_soyad || "(adsız)" }))
          .sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr"))}
        // Pasif ürünler de listede: eski şikayet artık üretilmeyen bir ürüne
        // aitse adı kaybolmasın. Aktifler üstte.
        urunler={[...urunler].sort(
          (a, b) =>
            Number(b.aktif !== false) - Number(a.aktif !== false) ||
            a.ad.localeCompare(b.ad, "tr"),
        )}
        benId={profile.id}
        yetki={yetki}
        bugun={bugun}
        tabloYok={Boolean(sikayetSonuc.hata)}
      />
    </div>
  );
}
