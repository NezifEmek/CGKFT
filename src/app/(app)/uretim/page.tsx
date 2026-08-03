import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir, sonuclaGetir } from "@/lib/supabase/fetch-all";
import type { Urun, UretimKaydi } from "@/lib/uretim";
import { UretimArayuz } from "./uretim-arayuz";

export default async function UretimSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const bugun = new Date().toISOString().slice(0, 10);

  // uretim_tanimlari (tesis/hat/vardiya) artık okunmuyor — o alanlar
  // formdan kaldırıldı. Tablo veritabanında duruyor ama kullanılmıyor.
  const [kayitSonuc, urunler] = await Promise.all([
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
        kayitlar={kayitSonuc.veri}
        // Pasif ürünler listede kalır (geçmiş kayıtlar okunabilsin diye),
        // ekran onları "(pasif)" diye işaretler.
        urunler={urunler}
        bugun={bugun}
        yazabilir={yazabilir}
        yonetimMi={yonetimMi}
        tabloYok={Boolean(kayitSonuc.hata)}
      />
    </div>
  );
}
