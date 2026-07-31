import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { primAyarlariNormalize, pozisyonlariNormalize } from "@/lib/dokuman";
import { gorunurPozisyonlar } from "@/lib/organizasyon";
import { aySirala } from "@/lib/analytics";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import { PrimArayuz, type AyOgesi } from "./prim-arayuz";

export default async function PrimHakedisSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: subeler }, satislar, { data: aylar }, ayarSonuc] = await Promise.all([
    supabase.from("subeler").select("*").returns<Sube[]>(),
    // Sayfalama şart: aylik_satislar 1000 satırı aşıyor ve PostgREST tek
    // istekte en fazla 1000 satır döndürüyor. Bu atlandığında fiili kg'lar
    // eksik geliyordu (HAZİRAN 2026: 48.247 yerine 19.403).
    tumSatirlariGetir<AylikSatis>((from, to) =>
      supabase.from("aylik_satislar").select("*").range(from, to),
    ),
    supabase.from("aylar").select("*").returns<Ay[]>(),
    supabase
      .from("dokuman_ayarlari")
      .select("prim_ayarlari")
      .eq("id", 1)
      .maybeSingle<{ prim_ayarlari: unknown }>(),
  ]);

  const tabloYok = Boolean(ayarSonuc.error);
  const ayarlar = primAyarlariNormalize(ayarSonuc.data?.prim_ayarlari);

  // Admin dışındaki kullanıcı kişi başı prim tablosunda yalnızca kendisini ve
  // astlarını görür. Havuzlar ve şirket toplamları herkese açık kalır —
  // hedefin tutup tutmadığını görmek herkesin işi.
  const { data: dokData } = await supabase
    .from("dokuman_ayarlari")
    .select("pozisyonlar")
    .eq("id", 1)
    .maybeSingle<{ pozisyonlar: unknown }>();
  const pozisyonlar = pozisyonlariNormalize(dokData?.pozisyonlar);
  const gorunurPoz = gorunurPozisyonlar(profile.rol, profile.pozisyon_id, pozisyonlar);
  const gorunurKisiAdlari = gorunurPoz
    ? new Set(
        pozisyonlar
          .filter((p) => gorunurPoz.has(p.id))
          .map((p) => (p.adSoyad || "").trim())
          .filter(Boolean),
      )
    : null;

  // Yıl içinde takvim sırası, yıllar arasında artan sıra.
  const yillar = [...new Set((aylar ?? []).map((a) => a.yil))].sort((x, y) => x - y);
  const ayListesi: AyOgesi[] = yillar.flatMap((yil) =>
    aySirala((aylar ?? []).filter((a) => a.yil === yil).map((a) => a.ay)).map((ay) => ({
      yil,
      ay,
    })),
  );

  const duzenlenebilir =
    !tabloYok && (profile.rol === "admin" || profile.rol === "genel_mudur");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Prim Hakediş</h1>
        <p className="text-sm text-neutral-500">
          Tonaj primi · şirket geneli hedef aşılmadan hiçbir havuz oluşmaz · katsayılar görev
          tanımı belgesi Bölüm 8.3
        </p>
      </div>

      {tabloYok && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          <b>Ayar tablosu henüz oluşturulmamış.</b> Hesaplama, belgedeki orijinal katsayılarla
          çalışıyor; ayar değişiklikleri kaydedilemez.
        </div>
      )}

      {ayListesi.length ? (
        <PrimArayuz
          subeler={subeler ?? []}
          satislar={satislar}
          aylar={ayListesi}
          ayarlar={ayarlar}
          duzenlenebilir={duzenlenebilir}
          gorunurKisiler={gorunurKisiAdlari ? [...gorunurKisiAdlari] : null}
        />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Henüz ay verisi yok. Önce <b>Aylar &amp; Veri</b> sayfasından ay ekleyin.
        </div>
      )}
    </div>
  );
}
