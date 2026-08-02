import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { primAyarlariNormalize, pozisyonlariNormalize } from "@/lib/dokuman";
import { aySirala } from "@/lib/analytics";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import type { Personel, Atama } from "@/lib/kadro";
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

  // Kadro: adlar artık prim ayarlarındaki elle yazılmış listeden değil,
  // tarihli pozisyon atamalarından geliyor. Ay seçimi istemci tarafında
  // yapıldığı için ham kayıtlar oraya veriliyor ve o ayın kadrosu orada
  // çözülüyor. Tablolar yoksa (0018 uygulanmadıysa) boş gelir ve ekran
  // eski listeye düşer.
  const [personeller, atamalar] = await Promise.all([
    tumSatirlariGetir<Personel>((f, t) =>
      supabase.from("personeller").select("*").range(f, t).returns<Personel[]>(),
    ).catch(() => [] as Personel[]),
    tumSatirlariGetir<Atama>((f, t) =>
      supabase.from("pozisyon_atamalari").select("*").range(f, t).returns<Atama[]>(),
    ).catch(() => [] as Atama[]),
  ]);

  // Prim ÖZELDİR: admin dışındaki kullanıcı yalnızca KENDİ tutarını görür —
  // astlarınınkini bile değil (Nezif: "sadece kendi primini görmeli").
  // KPI ve görev tanımında astlar görünür, primde görünmez; para bilgisi
  // yönetim bilgisinden farklı ele alınıyor.
  const { data: dokData } = await supabase
    .from("dokuman_ayarlari")
    .select("pozisyonlar")
    .eq("id", 1)
    .maybeSingle<{ pozisyonlar: unknown }>();
  const pozisyonlar = pozisyonlariNormalize(dokData?.pozisyonlar);
  const kendiPoz = pozisyonlar.find((p) => p.id === profile.pozisyon_id);
  const gorunurKisiAdlari =
    profile.rol === "admin"
      ? null
      : new Set([kendiPoz?.adSoyad?.trim()].filter(Boolean) as string[]);

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
          personeller={personeller}
          atamalar={atamalar}
          pozisyonlar={pozisyonlar.map((p) => ({
            id: p.id,
            unvan: p.unvan,
            adSoyad: p.adSoyad ?? "",
            doluMu: true,
          }))}
        />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Henüz ay verisi yok. Önce <b>Aylar &amp; Veri</b> sayfasından ay ekleyin.
        </div>
      )}
    </div>
  );
}
