import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Sube, Denetim, Skor } from "@/types/database";
import type { GecmisKayit } from "@/components/sube-gecmis-paneli";
import { DenetimFormu, type FormSube } from "./denetim-formu";
import { GecmisListesi, type GecmisKaydi } from "./gecmis-listesi";

export default async function SubeDenetimiSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;
  const sekme = sp.sekme === "gecmis" ? "gecmis" : "form";

  const [{ data: subeler }, { data: denetimler }, { data: skorlar }] = await Promise.all([
    supabase.from("subeler").select("*").order("ad").returns<Sube[]>(),
    supabase.from("denetimler").select("*").order("tarih", { ascending: false }).returns<Denetim[]>(),
    // Form içindeki geçmiş paneli iki kayıt türünü birlikte gösteriyor.
    supabase.from("skorlar").select("*").order("tarih", { ascending: false }).returns<Skor[]>(),
  ]);

  const subelerListe = subeler ?? [];
  const subeAdMap = new Map(subelerListe.map((s) => [s.id, s]));

  const formSubeler: FormSube[] = subelerListe.map((s) => ({
    id: s.id,
    ad: s.ad,
    bolge: s.bolge,
    il: s.il,
    ilce: s.ilce,
  }));

  const kayitlar: GecmisKaydi[] = (denetimler ?? []).map((d) => {
    const detay = (d.detay ?? {}) as Record<string, unknown>;
    const sube = subeAdMap.get(d.sube_id);
    return {
      id: d.id,
      subeId: d.sube_id,
      subeAd: sube?.ad ?? "(bilinmeyen şube)",
      bolge: sube?.bolge ?? "",
      tarih: d.tarih,
      puan: d.puan == null ? null : Number(d.puan),
      notlar: d.notlar ?? "",
      tur: typeof detay.tur === "string" ? detay.tur : "",
      denetleyen: typeof detay.denetleyen === "string" ? detay.denetleyen : "",
      bolumPuanlar: (detay.bolumPuanlar ?? {}) as Record<string, number>,
    };
  });

  // Formdaki "bu şubenin geçmişi" paneli için denetim + hızlı skor birleşik listesi.
  const gecmis: GecmisKayit[] = [
    ...kayitlar.map((k) => ({
      id: k.id,
      subeId: k.subeId,
      tarih: k.tarih,
      puan: k.puan,
      tur: k.tur,
      kaynak: "denetim" as const,
      kisi: k.denetleyen,
    })),
    ...(skorlar ?? []).map((s) => {
      const detay = (s.detay ?? {}) as Record<string, unknown>;
      return {
        id: s.id,
        subeId: s.sube_id,
        tarih: s.tarih,
        puan: s.puan == null ? null : Number(s.puan),
        tur: typeof detay.tur === "string" ? detay.tur : "",
        kaynak: "skor" as const,
        kisi: "",
      };
    }),
  ];

  const sekmeSinif = (aktif: boolean) =>
    `px-5 py-2.5 text-sm border-b-2 -mb-0.5 ${
      aktif
        ? "border-red-700 text-red-700 dark:text-red-400 font-semibold"
        : "border-transparent text-neutral-500"
    }`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Şube Denetimi</h1>
        <p className="text-sm text-neutral-500">
          6 kategoride 40 soru · her soru 1–3 puan · ham 120 puan 100&apos;e normalize edilir.
        </p>
      </div>

      <div className="flex border-b-2 border-neutral-200 dark:border-neutral-800">
        <Link href="/sube-denetimi" className={sekmeSinif(sekme === "form")}>
          📋 Yeni Denetim
        </Link>
        <Link href="/sube-denetimi?sekme=gecmis" className={sekmeSinif(sekme === "gecmis")}>
          📊 Denetim Geçmişi{kayitlar.length ? ` (${kayitlar.length})` : ""}
        </Link>
      </div>

      {sekme === "form" ? (
        subelerListe.length ? (
          <DenetimFormu
            subeler={formSubeler}
            adSoyad={profile.ad_soyad ?? ""}
            gecmis={gecmis}
          />
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
            Denetim girebileceğiniz görünür şube yok.
          </div>
        )
      ) : (
        <GecmisListesi kayitlar={kayitlar} silebilir />
      )}
    </div>
  );
}
