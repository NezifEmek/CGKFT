import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir, sonuclaGetir } from "@/lib/supabase/fetch-all";
import type { Profile } from "@/types/database";
import { OneriArayuz, type Oneri } from "./oneri-arayuz";

interface OneriSatir {
  id: string;
  baslik: string;
  aciklama: string;
  kategori: string;
  durum: string;
  oncelik: string;
  yonetim_notu: string;
  ekleyen_id: string;
  created_at: string;
}

export default async function OnerilerSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [oneriSonuc, destekler, { data: profiller }] = await Promise.all([
    sonuclaGetir<OneriSatir>(() =>
      tumSatirlariGetir<OneriSatir>((f, t) =>
        supabase.from("oneriler").select("*").order("created_at", { ascending: false }).range(f, t),
      ),
    ),
    tumSatirlariGetir<{ oneri_id: string; profil_id: string }>((f, t) =>
      supabase.from("oneri_destekleri").select("*").range(f, t),
    ).catch(() => [] as { oneri_id: string; profil_id: string }[]),
    supabase.from("profiles").select("id, ad_soyad").returns<Profile[]>(),
  ]);

  const destekSay = new Map<string, number>();
  const benimDestek = new Set<string>();
  for (const d of destekler) {
    destekSay.set(d.oneri_id, (destekSay.get(d.oneri_id) ?? 0) + 1);
    if (d.profil_id === profile.id) benimDestek.add(d.oneri_id);
  }

  const oneriler = oneriSonuc.veri;
  const liste: Oneri[] = oneriler.map((o) => ({
    ...o,
    destekSayisi: destekSay.get(o.id) ?? 0,
    destekledimMi: benimDestek.has(o.id),
  }));

  const adlar = Object.fromEntries(
    (profiller ?? []).map((p) => [p.id, p.ad_soyad || "(adsız)"]),
  );
  const yonetimMi = profile.rol === "admin" || profile.rol === "genel_mudur";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Öneriler</h1>
        <p className="text-sm text-neutral-500">
          Yazılım, süreç veya operasyonla ilgili önerilerinizi buraya yazın. Destek verilen
          öneriler öne çıkar; yönetim durumunu buradan günceller.
        </p>
      </div>

      {oneriSonuc.hata ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          <b>Veritabanı tablosu henüz oluşturulmamış.</b> Bu ekranın çalışması için{" "}
          <code className="text-xs">supabase/migrations/0009_oneriler.sql</code> dosyasındaki
          SQL&apos;in Supabase&apos;de çalıştırılması gerekiyor.
        </div>
      ) : (
        <OneriArayuz
          oneriler={liste}
          adlar={adlar}
          benId={profile.id}
          yonetimMi={yonetimMi}
        />
      )}
    </div>
  );
}
