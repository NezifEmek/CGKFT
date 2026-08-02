import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { tumSatirlariGetir } from "@/lib/supabase/fetch-all";
import type { Sube, AylikSatis, Ay } from "@/types/database";
import {
  aySirala,
  gunSayisiMap,
  subeKgOzetleri,
  kirilimHesapla,
  segmentBul,
  aylikTrendHesapla,
  kumulatifOzetHesapla,
  aylikYoYHesapla,
  acikSubeSayisi,
  type Esik,
} from "@/lib/analytics";
import {
  AylikTrendGrafik,
  MerkezFranchiseGrafik,
  SegmentDonut,
  YatayCubukGrafik,
} from "@/components/grafikler";
import { DikkatPaneli } from "@/components/dikkat-paneli";
import { dikkatSatirlari } from "@/lib/dikkat";
import { YazdirDugmesi } from "@/components/yazdir-dugmesi";

const CARI_YIL = 2026;
const ONCEKI_YIL = 2025;

const fmt = (n: number) => new Intl.NumberFormat("tr-TR").format(Math.round(n));
const fmt2 = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmt1 = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

/** ▲ %8 / ▼ %1 rozeti — eski paneldeki yoyDeg() karşılığı. */
function Degisim({ oran }: { oran: number | null }) {
  if (oran === null) return <span className="text-neutral-400">—</span>;
  const artiMi = oran >= 0;
  return (
    <b className={artiMi ? "text-emerald-600" : "text-red-500"}>
      {artiMi ? "▲" : "▼"} %{Math.abs(Math.round(oran * 100))}
    </b>
  );
}

function KpiKart({
  etiket,
  deger,
  birim,
  alt,
  dip,
  renk,
}: {
  etiket: string;
  deger: string;
  birim?: string;
  alt: React.ReactNode;
  dip: React.ReactNode;
  renk: string;
}) {
  return (
    <div
      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 border-l-4"
      style={{ borderLeftColor: renk }}
    >
      <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">{etiket}</div>
      <div className="text-2xl font-bold leading-tight">
        {deger}
        {birim && <small className="text-sm font-medium text-neutral-500 ml-1">{birim}</small>}
      </div>
      <div className="text-xs text-neutral-500 mt-1">{alt}</div>
      <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-500">
        {dip}
      </div>
    </div>
  );
}

function Kart({
  baslik,
  sagUst,
  children,
}: {
  baslik: string;
  sagUst?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
        <h3 className="font-medium text-sm">{baslik}</h3>
        {sagUst}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default async function GenelBakisSayfasi({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const sp = await searchParams;

  // RLS sayesinde bu sorgular otomatik olarak kullanıcının rolüne göre scoplanır
  // (denetmen: atandığı şube; bölge müdürü: kendi bölgesi; admin/GM: hepsi).
  const [{ data: subeler }, satislar, { data: aylar }, { data: segmentAyar }] = await Promise.all([
    supabase.from("subeler").select("*").returns<Sube[]>(),
    tumSatirlariGetir<AylikSatis>((from, to) =>
      supabase.from("aylik_satislar").select("*").range(from, to),
    ),
    supabase.from("aylar").select("*").returns<Ay[]>(),
    supabase.from("segment_ayarlari").select("*").eq("id", 1).single(),
  ]);

  // "Dikkat gerektirenler" verisi. Modüllerin bir kısmı henüz kurulmamış
  // olabilir; her biri ayrı yakalanıyor ki biri eksikse ana sayfa çökmesin.
  const bosa = <T,>(p: PromiseLike<{ data: T[] | null }>) =>
    Promise.resolve(p).then((r) => r.data ?? []).catch(() => [] as T[]);

  const [dSikayet, dAtama, dSozlesme, dGorev, dErteleme, dOneri, dDenetim] = await Promise.all([
    bosa<{ id: string; durum: string; son_cozum_tarihi: string | null }>(
      supabase.from("sikayetler").select("id, durum, son_cozum_tarihi"),
    ),
    bosa<{ sikayet_id: string }>(supabase.from("sikayet_atamalari").select("sikayet_id")),
    bosa<{ id: string; bitis: string | null; uyari_gun: number }>(
      supabase.from("sozlesmeler").select("id, bitis, uyari_gun"),
    ),
    bosa<{ id: string; durum: string; termin: string }>(
      supabase.from("toplanti_gorevleri").select("id, durum, termin"),
    ),
    bosa<{ id: string; onay_durumu: string }>(
      supabase.from("gorev_ertelemeleri").select("id, onay_durumu"),
    ),
    bosa<{ id: string; durum: string }>(supabase.from("oneriler").select("id, durum")),
    bosa<{ sube_id: string; tarih: string }>(supabase.from("denetimler").select("sube_id, tarih")),
  ]);

  const subelerListe = subeler ?? [];
  const gunMap = gunSayisiMap(aylar ?? []);
  const tumAylar = aySirala((aylar ?? []).filter((a) => a.yil === CARI_YIL).map((a) => a.ay));
  const esikler = (segmentAyar?.esikler ?? []) as Esik[];

  if (!tumAylar.length) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">Genel Bakış</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Henüz tanımlı ay yok. <b>Şubeler</b> ekranından ay ekleyin.
        </div>
      </div>
    );
  }

  // ── Dönem aralığı ────────────────────────────────────────────────────────
  const bas = tumAylar.includes(sp.bas ?? "") ? sp.bas! : tumAylar[0];
  const bit = tumAylar.includes(sp.bit ?? "") ? sp.bit! : tumAylar[tumAylar.length - 1];
  const i1 = tumAylar.indexOf(bas);
  const i2 = tumAylar.indexOf(bit);
  const secilenAylar = tumAylar.slice(Math.min(i1, i2), Math.max(i1, i2) + 1);
  const tumAyMi = secilenAylar.length === tumAylar.length;

  // ── Şirket özetleri (eski panelin kumulatifOzet mantığı) ─────────────────
  const trend = aylikTrendHesapla(subelerListe, satislar, CARI_YIL, secilenAylar, gunMap);
  const trendMs = aylikTrendHesapla(subelerListe, satislar, CARI_YIL, secilenAylar, gunMap, "MS");
  const trendFr = aylikTrendHesapla(subelerListe, satislar, CARI_YIL, secilenAylar, gunMap, "FR");

  const kum = kumulatifOzetHesapla(subelerListe, trend);
  const ms = kumulatifOzetHesapla(subelerListe, trendMs, "MS");
  const fr = kumulatifOzetHesapla(subelerListe, trendFr, "FR");

  const yoy = aylikYoYHesapla(subelerListe, satislar, CARI_YIL, ONCEKI_YIL, secilenAylar);
  const yoyKgCari = yoy.reduce((t, r) => t + r.kgCari, 0);
  const yoyKgOnceki = yoy.reduce((t, r) => t + r.kgOnceki, 0);
  const yoyDegisim = yoyKgOnceki > 0 ? (yoyKgCari - yoyKgOnceki) / yoyKgOnceki : null;

  const msSubeler = subelerListe.filter((s) => s.tip === "MS");
  const frSubeler = subelerListe.filter((s) => s.tip === "FR");
  const yoyMsOnceki = aylikYoYHesapla(msSubeler, satislar, CARI_YIL, ONCEKI_YIL, secilenAylar).reduce(
    (t, r) => t + r.kgOnceki,
    0,
  );
  const yoyFrOnceki = aylikYoYHesapla(frSubeler, satislar, CARI_YIL, ONCEKI_YIL, secilenAylar).reduce(
    (t, r) => t + r.kgOnceki,
    0,
  );
  const msDegisim = yoyMsOnceki > 0 ? (ms.kg - yoyMsOnceki) / yoyMsOnceki : null;
  const frDegisim = yoyFrOnceki > 0 ? (fr.kg - yoyFrOnceki) / yoyFrOnceki : null;

  const acikSube25 = acikSubeSayisi(subelerListe, satislar, ONCEKI_YIL, secilenAylar);
  const ort25 =
    yoyKgOnceki > 0 && acikSube25 > 0
      ? yoyKgOnceki / acikSube25 / secilenAylar.length / 30
      : null;
  const ortDegisim = ort25 !== null && ort25 > 0 ? (kum.ort - ort25) / ort25 : null;

  const ilkOrt = trend[0]?.ort ?? 0;
  const sonAy = trend[trend.length - 1];
  const ilkAyaGore = ilkOrt ? (sonAy.ort - ilkOrt) / ilkOrt : null;
  const sonAyYoy = yoy.find((r) => r.ay === sonAy?.ay) ?? null;

  const oran = (x: number) => (kum.kg ? Math.round((x / kum.kg) * 100) : 0);

  // ── Grafikler için kırılımlar ────────────────────────────────────────────
  const ozetCari = subeKgOzetleri(subelerListe, satislar, CARI_YIL, secilenAylar, gunMap);
  const bolgeler = kirilimHesapla(subelerListe, ozetCari, (s) => s.bolge);

  const segmentSayim = new Map<string, { esik: Esik; adet: number }>();
  for (const e of esikler) segmentSayim.set(e.ad, { esik: e, adet: 0 });
  for (const sube of subelerListe) {
    const o = ozetCari.get(sube.id);
    if (!o || o.toplamKg <= 0) continue;
    const eslesen = segmentBul(o.kgGunluk, esikler);
    if (eslesen) segmentSayim.get(eslesen.ad)!.adet++;
  }
  const segmentListe = [...segmentSayim.values()]
    .filter((s) => s.adet > 0)
    .sort((a, b) => b.esik.min - a.esik.min);

  const top10 = subelerListe
    .map((s) => ({ sube: s, kg: ozetCari.get(s.id)?.toplamKg ?? 0 }))
    .filter((r) => r.kg > 0)
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 10);

  // Şube başına son denetim tarihi — "unutulmuş şube" hesabı için.
  // Yalnızca aktif şubeler; kapanmış şubenin denetlenmemesi normal.
  const sonDenetimMap = new Map<string, string>();
  for (const d of dDenetim) {
    const onceki = sonDenetimMap.get(d.sube_id);
    if (!onceki || d.tarih > onceki) sonDenetimMap.set(d.sube_id, d.tarih);
  }
  const dikkat = dikkatSatirlari({
    bugun: new Date().toISOString().slice(0, 10),
    sikayetler: dSikayet,
    sikayetAtamalari: dAtama,
    sozlesmeler: dSozlesme,
    gorevler: dGorev,
    ertelemeler: dErteleme,
    oneriler: dOneri,
    subeDenetimleri: subelerListe
      .filter((s) => s.aktif !== false)
      .map((s) => ({ subeId: s.id, sonDenetim: sonDenetimMap.get(s.id) ?? null })),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Genel Bakış</h1>
        <p className="text-sm text-neutral-500">
          {profile.ad_soyad ? `Hoş geldin, ${profile.ad_soyad}.` : "Hoş geldin."} Aşağıdaki rakamlar
          yalnızca yetkili olduğun şubeleri kapsar.
        </p>
      </div>

      <div className="flex justify-end">
        <YazdirDugmesi baslik={`Genel-Bakis-${bas}-${bit}-${CARI_YIL}`} />
      </div>

      <DikkatPaneli satirlar={dikkat} />

      {/* Dönem seçici */}
      <form
        method="get"
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 flex items-center gap-2.5 flex-wrap"
      >
        <span className="font-semibold text-[13px]">📅 Dönem:</span>
        <select
          name="bas"
          defaultValue={bas}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
        >
          {tumAylar.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <span className="text-neutral-400">—</span>
        <select
          name="bit"
          defaultValue={bit}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2 py-1.5 text-sm"
        >
          {tumAylar.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3 py-1.5 text-sm font-medium"
        >
          Uygula
        </button>
        <span className="text-xs text-neutral-500">{secilenAylar.length} ay</span>
        {!tumAyMi && (
          <Link
            href="/"
            className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 px-2.5 py-1.5"
          >
            ✕ Tümünü göster
          </Link>
        )}
      </form>

      {/* KPI kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiKart
          renk="#c0392b"
          etiket={`Toplam Satış (${secilenAylar.length} ay)`}
          deger={fmt(kum.kg)}
          birim="kg"
          alt={`${secilenAylar[0]} – ${secilenAylar[secilenAylar.length - 1]}`}
          dip={
            <>
              {ONCEKI_YIL}: {fmt(yoyKgOnceki)} kg · <Degisim oran={yoyDegisim} />
            </>
          }
        />
        <KpiKart
          renk="#f59e0b"
          etiket="Günlük Ortalama"
          deger={fmt2(kum.ort)}
          birim="kg/gün"
          alt="şube · gün başına"
          dip={
            <>
              {ONCEKI_YIL}: {ort25 !== null ? fmt2(ort25) : "—"} kg/gün · <Degisim oran={ortDegisim} />
            </>
          }
        />
        <KpiKart
          renk="#2563eb"
          etiket="Aktif Şube"
          deger={fmt(kum.aktifSube)}
          alt={`${fmt(kum.toplamSube)} toplam kayıt`}
          dip={`${ONCEKI_YIL}: ${fmt(acikSube25)} şube açıktı`}
        />
        <KpiKart
          renk="#16a34a"
          etiket={`Son Ay (${sonAy?.ay ?? "—"})`}
          deger={fmt(sonAy?.kg ?? 0)}
          birim="kg"
          alt={
            ilkAyaGore === null ? (
              "İlk aya göre —"
            ) : (
              <>
                İlk aya göre{" "}
                <span className={ilkAyaGore >= 0 ? "text-emerald-600" : "text-red-500"}>
                  {ilkAyaGore >= 0 ? "+" : ""}%{fmt1(ilkAyaGore * 100)}
                </span>
              </>
            )
          }
          dip={
            <>
              {ONCEKI_YIL}: {sonAyYoy ? `${fmt(sonAyYoy.kgOnceki)} kg` : "—"} ·{" "}
              <Degisim oran={sonAyYoy?.degisim ?? null} />
            </>
          }
        />
        <KpiKart
          renk="#7c3aed"
          etiket="Merkez Şube (MŞ)"
          deger={fmt(ms.kg)}
          birim={`kg · %${oran(ms.kg)}`}
          alt={`${fmt(ms.toplamSube)} şube · ort ${fmt2(ms.ort)} kg/gün`}
          dip={
            <>
              {ONCEKI_YIL}: {fmt(yoyMsOnceki)} kg · <Degisim oran={msDegisim} />
            </>
          }
        />
        <KpiKart
          renk="#c0392b"
          etiket="Franchise (FR)"
          deger={fmt(fr.kg)}
          birim={`kg · %${oran(fr.kg)}`}
          alt={`${fmt(fr.toplamSube)} şube · ort ${fmt2(fr.ort)} kg/gün`}
          dip={
            <>
              {ONCEKI_YIL}: {fmt(yoyFrOnceki)} kg · <Degisim oran={frDegisim} />
            </>
          }
        />
      </div>

      {!subelerListe.length && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Henüz görünür bir şube yok. Admin/Genel Müdür şube ekleyebilir; Denetmen için atanmış şube
          olması gerekir.
        </div>
      )}

      {subelerListe.length > 0 && (
        <>
          <Kart baslik="📈 Aylık Satış Trendi">
            <AylikTrendGrafik
              aylar={secilenAylar}
              cari={yoy.map((r) => r.kgCari)}
              onceki={yoy.map((r) => r.kgOnceki)}
              gunlukOrt={trend.map((t) => t.ort)}
              cariYil={CARI_YIL}
              oncekiYil={ONCEKI_YIL}
            />
          </Kart>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Kart baslik="Merkez vs Franchise (aylık kg)">
              <MerkezFranchiseGrafik
                aylar={secilenAylar}
                merkez={trendMs.map((t) => t.kg)}
                franchise={trendFr.map((t) => t.kg)}
              />
            </Kart>
            <Kart
              baslik="Segment Dağılımı (kümülatif)"
              sagUst={
                <Link href="/segmentasyon" className="text-xs text-neutral-500 hover:underline">
                  tümünü gör →
                </Link>
              }
            >
              <SegmentDonut
                etiketler={segmentListe.map((s) => s.esik.ad)}
                adetler={segmentListe.map((s) => s.adet)}
                renkler={segmentListe.map((s) => s.esik.renk)}
              />
            </Kart>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Kart
              baslik="Bölgelere Göre Satış (kg)"
              sagUst={
                <Link href="/bolge-analizi" className="text-xs text-neutral-500 hover:underline">
                  tümünü gör →
                </Link>
              }
            >
              <YatayCubukGrafik
                etiketler={bolgeler.map((b) => b.anahtar)}
                degerler={bolgeler.map((b) => b.toplamKg)}
                yukseklik={Math.max(240, bolgeler.length * 34)}
              />
            </Kart>
            <Kart
              baslik="En Çok Satan 10 Şube"
              sagUst={
                <Link href="/top30" className="text-xs text-neutral-500 hover:underline">
                  top 30 →
                </Link>
              }
            >
              <YatayCubukGrafik
                etiketler={top10.map((r) => r.sube.ad)}
                degerler={top10.map((r) => r.kg)}
                renk="#2563eb"
                yukseklik={340}
              />
            </Kart>
          </div>

          <Kart
            baslik={`📅 ${CARI_YIL} vs ${ONCEKI_YIL} — Yıl İçi Karşılaştırması`}
            sagUst={
              <Link href="/yoy-karsilastirma" className="text-xs text-neutral-500 hover:underline">
                detay →
              </Link>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">Ay</th>
                    <th className="px-3 py-2 text-right">{CARI_YIL} (kg)</th>
                    <th className="px-3 py-2 text-right">{ONCEKI_YIL} (kg)</th>
                    <th className="px-3 py-2 text-right">Fark (kg)</th>
                    <th className="px-3 py-2 text-right">YoY %</th>
                  </tr>
                </thead>
                <tbody>
                  {yoy
                    .filter((r) => r.kgCari > 0)
                    .map((r) => {
                      const fark = r.kgCari - r.kgOnceki;
                      return (
                        <tr key={r.ay} className="border-t border-neutral-100 dark:border-neutral-800">
                          <td className="px-3 py-1.5 font-semibold text-xs">{r.ay}</td>
                          <td className="px-3 py-1.5 text-right font-bold">{fmt(r.kgCari)}</td>
                          <td className="px-3 py-1.5 text-right text-neutral-500">{fmt(r.kgOnceki)}</td>
                          <td
                            className={`px-3 py-1.5 text-right font-semibold ${fark >= 0 ? "text-emerald-600" : "text-red-500"}`}
                          >
                            {fark >= 0 ? "+" : ""}
                            {fmt(fark)}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <Degisim oran={r.degisim} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-200 dark:border-neutral-700 font-bold bg-neutral-50 dark:bg-neutral-800/50">
                    <td className="px-3 py-2 text-xs">TOPLAM</td>
                    <td className="px-3 py-2 text-right">{fmt(yoyKgCari)}</td>
                    <td className="px-3 py-2 text-right text-neutral-500">{fmt(yoyKgOnceki)}</td>
                    <td
                      className={`px-3 py-2 text-right ${yoyKgCari - yoyKgOnceki >= 0 ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {yoyKgCari - yoyKgOnceki >= 0 ? "+" : ""}
                      {fmt(yoyKgCari - yoyKgOnceki)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Degisim oran={yoyDegisim} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Kart>
        </>
      )}
    </div>
  );
}
