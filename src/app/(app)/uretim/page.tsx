import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir, sonuclaGetir } from "@/lib/supabase/fetch-all";
import type { Urun, UretimKaydi, SatisSatiri } from "@/lib/uretim";
import { UretimArayuz } from "./uretim-arayuz";

export default async function UretimSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const bugun = new Date().toISOString().slice(0, 10);

  // uretim_tanimlari (tesis/hat/vardiya) artık okunmuyor — o alanlar
  // formdan kaldırıldı. Tablo veritabanında duruyor ama kullanılmıyor.
  const [kayitSonuc, urunler, satislar] = await Promise.all([
    sonuclaGetir<UretimKaydi>(() =>
      tumSatirlariGetir<UretimKaydi>((f, t) =>
        supabase
          .from("uretim_kayitlari")
          .select("*")
          .order("tarih", { ascending: false })
          .range(f, t)
          .returns<UretimKaydi[]>(),
      ),
    ),
    tumSatirlariGetir<Urun>((f, t) =>
      supabase
        .from("uretim_urunleri")
        .select("*")
        .order("kod")
        .range(f, t)
        .returns<Urun[]>(),
    ).catch(() => [] as Urun[]),
    // Şube satışları — üretimle aynı ayı karşılaştırmak için.
    // 2.800'den fazla satır var; sayfalama olmadan 1000'de kesilir ve
    // aylık toplam sessizce eksik çıkardı. tumSatirlariGetir bunu önlüyor.
    //
    // Normal (RLS'li) istemciyle okunuyor: kullanıcı yalnızca görme
    // yetkisi olduğu şubelerin satışını toplar — ekran bunu açıkça yazar.
    tumSatirlariGetir<SatisSatiri>((f, t) =>
      supabase
        .from("aylik_satislar")
        .select("yil, ay, kg")
        .range(f, t)
        .returns<SatisSatiri[]>(),
    ).catch(() => [] as SatisSatiri[]),
  ]);

  const yazabilir = profile.rol !== "denetmen";
  const yonetimMi = profile.rol === "admin" || profile.rol === "genel_mudur";
  // Satış rakamı yalnızca tüm şubeleri görenlerde şirket toplamına eşit.
  const tumSubeleriGorur = yonetimMi || profile.kapsam_turu === "tum";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Günlük Üretim Takibi</h1>
        <p className="text-sm text-neutral-500">
          Üretimin ürün ve ambalaj kırılımında günlük kaydı. Her ürün{" "}
          <b>kendi raporlama biriminde</b> toplanır: çiğköfte kilogram, lavaş 50&apos;lik
          paket, mini soslar 250&apos;lik paket, ekşi sos 12&apos;li paket, acı soslar adet.
          Giriş hangi birimde yapılırsa yapılsın (adet, koli, kg) rapor hep aynı birimde
          çıkar. Birim, Ürünler sekmesinden değiştirilebilir.
        </p>
      </div>

      <UretimArayuz
        kayitlar={kayitSonuc.veri}
        // Pasif ürünler listede kalır (geçmiş kayıtlar okunabilsin diye),
        // ekran onları "(pasif)" diye işaretler.
        urunler={urunler}
        satislar={satislar}
        bugun={bugun}
        yazabilir={yazabilir}
        yonetimMi={yonetimMi}
        tumSubeleriGorur={tumSubeleriGorur}
        tabloYok={Boolean(kayitSonuc.hata)}
      />
    </div>
  );
}
