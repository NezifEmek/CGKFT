import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { primAyarlariNormalize } from "@/lib/dokuman";
import { primHesapla } from "@/lib/prim";
import { aySirala } from "@/lib/analytics";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import { PrimProjeksiyonGrafik } from "@/components/grafikler";
import type { Sube, AylikSatis, Ay } from "@/types/database";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("tr-TR");
}

export default async function PrimProjeksiyonSayfasi() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: subeler }, satislar, { data: aylar }, ayarSonuc] = await Promise.all([
    supabase.from("subeler").select("*").returns<Sube[]>(),
    // Sayfalama şart — bkz. prim-hakedis: tek istekte en fazla 1000 satır gelir.
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

  const ayarlar = primAyarlariNormalize(ayarSonuc.data?.prim_ayarlari);

  const yillar = [...new Set((aylar ?? []).map((a) => a.yil))].sort((x, y) => x - y);
  const ayListesi = yillar.flatMap((yil) =>
    aySirala((aylar ?? []).filter((a) => a.yil === yil).map((a) => a.ay)).map((ay) => ({ yil, ay })),
  );

  if (!ayListesi.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Prim Projeksiyonu</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Henüz ay verisi yok. Önce <b>Aylar &amp; Veri</b> sayfasından ay ekleyin.
        </div>
      </div>
    );
  }

  const satirlar = ayListesi.map(({ yil, ay }) => {
    const h = primHesapla(subeler ?? [], satislar, yil, ay, ayarlar);
    const havuzToplam =
      h.uretimHavuz + h.merkezHavuz + h.bolge1Havuz + h.bolge2Havuz + h.merkezSoruHavuz;
    return { yil, ay, h, havuzToplam };
  });

  const primli = satirlar.filter((r) => !r.h.primYok);
  const kumulatifHavuz = primli.reduce((t, r) => t + r.havuzToplam, 0);

  const topla = (f: (r: (typeof satirlar)[number]) => number) =>
    primli.reduce((t, r) => t + f(r), 0);

  const ozetKartlari = [
    { sayi: String(satirlar.length), etiket: "Toplam ay", renk: "" },
    { sayi: String(primli.length), etiket: "Prim olan ay", renk: "#16a34a" },
    { sayi: String(satirlar.length - primli.length), etiket: "Prim olmayan ay", renk: "#dc2626" },
    {
      sayi: kumulatifHavuz >= 1000 ? `${fmt(kumulatifHavuz / 1000)} B` : fmt(kumulatifHavuz),
      etiket: "Kümülatif havuz (TL)",
      renk: "",
    },
  ];

  const basliklar = [
    "Fiili (kg)",
    "Hedef (kg)",
    "Aşım (kg)",
    "Ü. havuzu",
    "M. havuzu",
    "B1 havuzu",
    "B2 havuzu",
    "Toplam havuz",
    ayarlar.merkez_sorumlu_ad,
    ayarlar.bolge1_ad,
    ayarlar.bolge2_ad,
    "Üretim (kişi)",
    "Merkez (kişi)",
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Prim Projeksiyonu</h1>
        <p className="text-sm text-neutral-500">
          Mevcut prim ayarlarının bütün aylara uygulanmış simülasyonu
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ozetKartlari.map((k) => (
          <div
            key={k.etiket}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 text-center"
          >
            <div className="text-2xl font-extrabold" style={{ color: k.renk || undefined }}>
              {k.sayi}
            </div>
            <div className="text-[11px] text-neutral-500 mt-1">{k.etiket}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border-l-[3px] border-red-700 px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
        ℹ️ Bu sayfa <b>simülasyondur</b>: bugünkü prim ayarları geçmiş ayların kg verisine
        uygulanır, geçmişte fiilen ödenen primi göstermez. FR şubeler <b>Merkez Yetkilisi</b>{" "}
        alanına göre bölünür — {ayarlar.bolge2_ad} ile eşleşenler Bölge 2, kalanı Bölge 1. Her
        bölgenin hedefi kendi tabanıyla sınırlı: Merkez {ayarlar.merkez_sube_hedef_kg} kg/şube (en
        az {fmt(ayarlar.merkez_taban_kg)} kg), Bölge 1 {ayarlar.bolge1_sube_hedef_kg} kg/şube (en az{" "}
        {fmt(ayarlar.bolge1_taban_kg)} kg), Bölge 2 {ayarlar.bolge2_sube_hedef_kg} kg/şube (en az{" "}
        {fmt(ayarlar.bolge2_taban_kg)} kg).
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-x-auto">
        <table className="w-full text-[13px] whitespace-nowrap">
          <thead className="text-[11px] uppercase text-neutral-500">
            <tr className="border-b-2 border-neutral-200 dark:border-neutral-800">
              <th className="px-3 py-2 text-left">Ay</th>
              {basliklar.map((b) => (
                <th key={b} className="px-3 py-2 text-center">
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {satirlar.map(({ yil, ay, h, havuzToplam }) => {
              if (h.primYok) {
                return (
                  <tr
                    key={`${yil}-${ay}`}
                    className="border-b border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="px-3 py-2 font-semibold">
                      {ay} {yil}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{fmt(h.toplamKg)}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{fmt(h.toplamHedef)}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-red-600">
                      {fmt(h.toplamAsim)}
                    </td>
                    <td colSpan={10} className="px-3 py-2 text-center text-neutral-400 italic">
                      Hedef aşılmadı
                    </td>
                  </tr>
                );
              }
              const hucreler = [
                fmt(h.toplamKg),
                fmt(h.toplamHedef),
                `+${fmt(h.toplamAsim)}`,
                fmt(h.uretimHavuz),
                fmt(h.merkezHavuz),
                fmt(h.bolge1Havuz),
                fmt(h.bolge2Havuz),
                fmt(havuzToplam),
                fmt(h.merkezSorumlu),
                fmt(h.bolge1Sorumlu),
                fmt(h.bolge2Sorumlu),
                fmt(h.uretimKisiBasina),
                fmt(h.merkezKisiBasina),
              ];
              return (
                <tr
                  key={`${yil}-${ay}`}
                  className="border-b border-neutral-100 dark:border-neutral-800 bg-emerald-50/60 dark:bg-emerald-950/20"
                >
                  <td className="px-3 py-2 font-semibold">
                    ✅ {ay} {yil}
                  </td>
                  {hucreler.map((v, i) => (
                    <td
                      key={i}
                      className={`px-3 py-2 text-center tabular-nums ${
                        i >= 2 ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""
                      } ${i === 7 ? "bg-emerald-100 dark:bg-emerald-950/50" : ""}`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {primli.length > 0 && (
            <tfoot>
              <tr className="bg-emerald-50 dark:bg-emerald-950/30 font-bold border-t-2 border-emerald-300 dark:border-emerald-900">
                <td className="px-3 py-2">TOPLAM ({primli.length} ay)</td>
                <td className="px-3 py-2 text-center text-neutral-400">—</td>
                <td className="px-3 py-2 text-center text-neutral-400">—</td>
                <td className="px-3 py-2 text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                  +{fmt(topla((r) => r.h.toplamAsim))}
                </td>
                {[
                  topla((r) => r.h.uretimHavuz),
                  topla((r) => r.h.merkezHavuz),
                  topla((r) => r.h.bolge1Havuz),
                  topla((r) => r.h.bolge2Havuz),
                  kumulatifHavuz,
                  topla((r) => r.h.merkezSorumlu),
                  topla((r) => r.h.bolge1Sorumlu),
                  topla((r) => r.h.bolge2Sorumlu),
                  topla((r) => r.h.uretimKisiBasina),
                  topla((r) => r.h.merkezKisiBasina),
                ].map((v, i) => (
                  <td
                    key={i}
                    className={`px-3 py-2 text-center tabular-nums text-emerald-700 dark:text-emerald-400 ${
                      i === 4 ? "bg-emerald-200/60 dark:bg-emerald-900/50" : ""
                    }`}
                  >
                    {fmt(v)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <h2 className="text-sm font-semibold mb-3">Aylık Prim Havuzu Projeksiyonu</h2>
        <PrimProjeksiyonGrafik
          aylar={satirlar.map((r) => `${r.ay.slice(0, 3)} ${String(r.yil).slice(2)}`)}
          havuz={satirlar.map((r) => Math.round(r.havuzToplam))}
          asim={satirlar.map((r) => Math.round(r.h.toplamAsim))}
        />
      </div>
    </div>
  );
}
