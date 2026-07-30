import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { pozisyonlariNormalize } from "@/lib/dokuman";
import { DokumanArayuz } from "./dokuman-arayuz";

export default async function DokumanSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("dokuman_ayarlari")
    .select("pozisyonlar, updated_at")
    .eq("id", 1)
    .maybeSingle<{ pozisyonlar: unknown; updated_at: string }>();

  // Tablo henüz oluşturulmadıysa ekran çökmesin — koddaki varsayılanlar gösterilir.
  const tabloYok = Boolean(error);
  const pozisyonlar = pozisyonlariNormalize(data?.pozisyonlar);
  const duzenlenebilir =
    !tabloYok && (profile.rol === "admin" || profile.rol === "genel_mudur");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Doküman Yönetimi</h1>
        <p className="text-sm text-neutral-500">
          Görev tanımları, KPI setleri ve prim bağlantıları · {pozisyonlar.length} pozisyon
          {data?.updated_at ? ` · son güncelleme ${data.updated_at.slice(0, 10)}` : ""}
        </p>
      </div>

      {tabloYok && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          <b>Veritabanı tablosu henüz oluşturulmamış.</b> Ekran şu an kodda gömülü orijinal
          içeriği gösteriyor; okuyabilir, yazdırabilir ve Word olarak indirebilirsiniz ama
          değişiklikler kaydedilemez. Kaydetmeyi açmak için{" "}
          <code className="text-xs">supabase/migrations/0002_dokuman_prim.sql</code> dosyasındaki
          SQL&apos;in Supabase&apos;de çalıştırılması gerekiyor.
        </div>
      )}

      <DokumanArayuz pozisyonlar={pozisyonlar} duzenlenebilir={duzenlenebilir} />
    </div>
  );
}
