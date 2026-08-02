import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Urun, UretimKaydi } from "@/lib/uretim";
import { UretimArayuz, type Tanim } from "./uretim-arayuz";

export default async function UretimSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const bugun = new Date().toISOString().slice(0, 10);

  let tabloYok = false;

  const [kayitlar, urunler, tanimlar] = await Promise.all([
    tumSatirlariGetir<UretimKaydi>((f, t) =>
      supabase
        .from("uretim_kayitlari")
        .select("*")
        .order("tarih", { ascending: false })
        .range(f, t)
        .returns<UretimKaydi[]>(),
    ).catch(() => {
      tabloYok = true;
      return [] as UretimKaydi[];
    }),
    tumSatirlariGetir<Urun>((f, t) =>
      supabase
        .from("uretim_urunleri")
        .select("*")
        .order("kod")
        .range(f, t)
        .returns<Urun[]>(),
    ).catch(() => [] as Urun[]),
    tumSatirlariGetir<Tanim>((f, t) =>
      supabase
        .from("uretim_tanimlari")
        .select("*")
        .order("tur")
        .order("sira")
        .order("ad")
        .range(f, t)
        .returns<Tanim[]>(),
    ).catch(() => [] as Tanim[]),
  ]);

  const yazabilir = profile.rol !== "denetmen";
  const yonetimMi = profile.rol === "admin" || profile.rol === "genel_mudur";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Günlük Üretim Takibi</h1>
        <p className="text-sm text-neutral-500">
          Üretimin ürün, ambalaj, hat, vardiya ve tesis kırılımında günlük kaydı. Adet, koli ve
          kilogram girişleri ürün tanımındaki birim ağırlıktan kilograma çevrilerek toplanır —
          çevrilemeyen kayıtlar toplama karıştırılmaz, ayrıca sayılır.
        </p>
      </div>

      <UretimArayuz
        kayitlar={kayitlar}
        // Pasif ürünler listede kalır (geçmiş kayıtlar okunabilsin diye),
        // ekran onları "(pasif)" diye işaretler.
        urunler={urunler}
        tanimlar={tanimlar.filter((t) => t.aktif !== false)}
        bugun={bugun}
        yazabilir={yazabilir}
        yonetimMi={yonetimMi}
        tabloYok={tabloYok}
      />
    </div>
  );
}
