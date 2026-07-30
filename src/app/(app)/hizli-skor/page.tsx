import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Sube, Skor } from "@/types/database";
import { SkorArayuz, type SkorSube, type SkorKaydi } from "./skor-arayuz";

export default async function HizliSkorSayfasi() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: subeler }, { data: skorlar }] = await Promise.all([
    supabase.from("subeler").select("*").order("ad").returns<Sube[]>(),
    supabase.from("skorlar").select("*").order("tarih", { ascending: false }).returns<Skor[]>(),
  ]);

  const subelerListe = subeler ?? [];
  const subeMap = new Map(subelerListe.map((s) => [s.id, s]));

  const formSubeler: SkorSube[] = subelerListe.map((s) => ({
    id: s.id,
    ad: s.ad,
    bolge: s.bolge,
    il: s.il,
    ilce: s.ilce,
  }));

  const kayitlar: SkorKaydi[] = (skorlar ?? []).map((k) => {
    const detay = (k.detay ?? {}) as Record<string, unknown>;
    const sube = subeMap.get(k.sube_id);
    return {
      id: k.id,
      subeAd: sube?.ad ?? "(bilinmeyen şube)",
      bolge: sube?.bolge ?? "",
      il: sube?.il ?? "",
      ilce: sube?.ilce ?? "",
      tarih: k.tarih,
      puan: k.puan == null ? null : Number(k.puan),
      tur: typeof detay.tur === "string" ? detay.tur : "",
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Hızlı Skor Girişi</h1>
        <p className="text-sm text-neutral-500">
          Gizli müşteri, kısa denetim veya ziyaret sonrası tek puanlık hızlı kayıt. Detaylı soru
          formu için <b>Şube Denetimi</b> ekranını kullanın.
        </p>
      </div>

      {/* yazabilir her rolde true — hangi şubeye yazılabildiğini RLS sınırlar
          (denetmen: atandığı şube, bölge müdürü: kendi bölgesi, admin/GM: hepsi). */}
      {subelerListe.length ? (
        <SkorArayuz subeler={formSubeler} kayitlar={kayitlar} yazabilir />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Skor girebileceğiniz görünür şube yok.
        </div>
      )}
    </div>
  );
}
