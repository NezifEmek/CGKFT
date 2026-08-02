import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Sube } from "@/types/database";
import { tumSatirlariGetir, sonuclaGetir } from "@/lib/supabase/fetch-all";
import type { GunlukKayit, Kalem } from "@/lib/merkez-gg";
import { GGArayuz, type GGSube } from "./gg-arayuz";

export default async function MerkezGelirGiderSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // Sayfalama şart: günlük defter 25 merkez şube × 365 gün ile tek yılda bile
  // 1000 satırı aşar; PostgREST tek istekte en fazla 1000 satır döndürür.
  const [{ data: subeler }, gunSonuc, kalemSonuc] = await Promise.all([
    supabase.from("subeler").select("*").eq("tip", "MS").order("ad").returns<Sube[]>(),
    sonuclaGetir<GunlukKayit>(() =>
      tumSatirlariGetir<GunlukKayit>((from, to) =>
        supabase
          .from("merkez_gg_gunluk")
          .select("*")
          .order("tarih", { ascending: false })
          .range(from, to),
      ),
    ),
    sonuclaGetir<Kalem>(() =>
      tumSatirlariGetir<Kalem>((from, to) =>
        supabase.from("merkez_gg_kalem").select("*").range(from, to),
      ),
    ),
  ]);

  const gunHam = gunSonuc.veri;
  const kalemHam = kalemSonuc.veri;
  const tabloYok = Boolean(gunSonuc.hata || kalemSonuc.hata);

  const ggSubeler: GGSube[] = (subeler ?? []).map((s) => ({
    id: s.id,
    ad: s.ad,
    il: s.il ?? "",
  }));

  const gunler = gunHam.map((g) => ({
    ...g,
    nakit: Number(g.nakit) || 0,
    kredi_karti: Number(g.kredi_karti) || 0,
    ticket: Number(g.ticket) || 0,
    yemek_sepeti: Number(g.yemek_sepeti) || 0,
    ayran: Number(g.ayran) || 0,
    yemek: Number(g.yemek) || 0,
    genel_masraf: Number(g.genel_masraf) || 0,
  }));

  const kalemler = kalemHam.map((k) => ({
    ...k,
    adet: Number(k.adet) || 0,
    tutar: Number(k.tutar) || 0,
  }));

  const yazabilir = !tabloYok && profile.rol !== "denetmen";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Merkez Şube Gelir-Gider</h1>
        <p className="text-sm text-neutral-500">
          {ggSubeler.length} merkez şube · {gunler.length} gün kaydı · {kalemler.length} aylık kalem
        </p>
      </div>

      {tabloYok ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          <b>Veritabanı tabloları henüz oluşturulmamış.</b> Bu ekranın çalışması için{" "}
          <code className="text-xs">supabase/migrations/0003_merkez_gg.sql</code> dosyasındaki
          SQL&apos;in Supabase&apos;de çalıştırılması gerekiyor.
        </div>
      ) : !ggSubeler.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Görebileceğiniz merkez şube (MŞ) yok.
        </div>
      ) : (
        <GGArayuz
          subeler={ggSubeler}
          gunler={gunler}
          kalemler={kalemler}
          yazabilir={yazabilir}
        />
      )}
    </div>
  );
}
