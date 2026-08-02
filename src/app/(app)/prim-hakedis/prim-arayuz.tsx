"use client";

import { useActionState, useMemo, useState } from "react";
import { primAyarlariKaydet, primAyarlariSifirla } from "./actions";
import { primHesapla, primPersonelSatirlari, primPersonelSatirlariKadrodan } from "@/lib/prim";
import {
  aydaGorevliler, kadroBilgisi, kadroKullanilabilir,
  type Personel, type Atama, type PozisyonKisa,
} from "@/lib/kadro";

import type { PrimAyarlari } from "@/lib/dokuman-varsayilan";
import { AYLAR_12, type Sube, type AylikSatis } from "@/types/database";

const girdiSinif =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";

const kartSinif =
  "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("tr-TR");
}

export interface AyOgesi {
  yil: number;
  ay: string;
}

export function PrimArayuz({
  subeler,
  satislar,
  aylar,
  ayarlar,
  duzenlenebilir,
  gorunurKisiler,
  personeller,
  atamalar,
  pozisyonlar,
}: {
  subeler: Sube[];
  satislar: AylikSatis[];
  aylar: AyOgesi[];
  ayarlar: PrimAyarlari;
  duzenlenebilir: boolean;
  /** null = sınır yok (admin). Doluysa yalnızca bu kişilerin satırı gösterilir. */
  gorunurKisiler: string[] | null;
  /** Kadro — adlar ve kişi sayıları buradan gelir. Boşsa eski listeye düşülür. */
  personeller: Personel[];
  atamalar: Atama[];
  pozisyonlar: PozisyonKisa[];
}) {
  const [secili, setSecili] = useState(() => {
    const son = aylar[aylar.length - 1];
    return son ? `${son.yil}|${son.ay}` : "";
  });
  const [ayarAcik, setAyarAcik] = useState(false);

  const [kaydetDurum, kaydetAction, kaydetPending] = useActionState(primAyarlariKaydet, null);
  const [sifirlaDurum, sifirlaAction, sifirlaPending] = useActionState(primAyarlariSifirla, null);
  const durum = kaydetDurum ?? sifirlaDurum;

  const [yilStr, ay] = secili.split("|");
  const yil = Number(yilStr);

  // Seçilen ayın kadrosu. Ay adı ("TEMMUZ") tarih biçimine çevriliyor;
  // atamalar tarihli olduğu için karşılaştırma böyle yapılabiliyor.
  const ayKisiler = useMemo(() => {
    const ayNo = (AYLAR_12 as readonly string[]).indexOf(ay) + 1;
    if (!ayNo || !yil) return [];
    return aydaGorevliler(`${yil}-${String(ayNo).padStart(2, "0")}`, atamalar, personeller, pozisyonlar);
  }, [yil, ay, atamalar, personeller, pozisyonlar]);

  // Kadro kuruluysa oradan, değilse eski elle yazılmış listeden.
  const kadroVar = kadroKullanilabilir(ayKisiler);

  const h = useMemo(
    () => primHesapla(subeler, satislar, yil, ay, ayarlar, kadroVar ? kadroBilgisi(ayKisiler) : undefined),
    [subeler, satislar, yil, ay, ayarlar, kadroVar, ayKisiler],
  );

  const tumPersonel = useMemo(
    () => (kadroVar ? primPersonelSatirlariKadrodan(h, ayKisiler) : primPersonelSatirlari(h, ayarlar)),
    [h, ayarlar, kadroVar, ayKisiler],
  );
  // Toplam her zaman TÜM personel üzerinden — kişi kendi satırını görmese de
  // havuzun tamamının ne kadar dağıtıldığı doğru görünsün.
  const toplamPrim = tumPersonel.reduce((t, p) => t + p.prim, 0);
  const trU = (s: string) => s.replace(/i/g, "İ").toLocaleUpperCase("tr").trim();
  const personel = useMemo(() => {
    if (!gorunurKisiler) return tumPersonel;
    const kume = new Set(gorunurKisiler.map(trU));
    return tumPersonel.filter((p) => kume.has(trU(p.ad)));
  }, [tumPersonel, gorunurKisiler]);
  const gizlenen = tumPersonel.length - personel.length;

  const bolgeKartlari = [
    { ad: "Şirket Geneli", kg: h.toplamKg, hedef: h.toplamHedef, asim: h.toplamAsim },
    { ad: "Merkez Şubeler", kg: h.merkezKg, hedef: h.merkezHedef, asim: h.merkezAsim },
    {
      ad: `Bölge 1 — ${ayarlar.bolge1_ad}`,
      kg: h.bolge1Kg,
      hedef: h.bolge1Hedef,
      asim: h.bolge1Asim,
    },
    {
      ad: `Bölge 2 — ${ayarlar.bolge2_ad}`,
      kg: h.bolge2Kg,
      hedef: h.bolge2Hedef,
      asim: h.bolge2Asim,
    },
  ];

  const havuzlar = [
    { ad: `Üretim Havuzu (aşım × ${ayarlar.uretim_katsayi_tl} TL/kg)`, tutar: h.uretimHavuz },
    { ad: `Merkez Havuzu (aşım × ${ayarlar.merkez_katsayi_tl} TL/kg)`, tutar: h.merkezHavuz },
    {
      ad: `Bölge 1 Havuzu (B1 aşım × ${ayarlar.bolge_katsayi_tl} TL/kg)`,
      tutar: h.bolge1Havuz,
    },
    {
      ad: `Bölge 2 Havuzu (B2 aşım × ${ayarlar.bolge_katsayi_tl} TL/kg)`,
      tutar: h.bolge2Havuz,
    },
    {
      ad: `Merkez Bölge Havuzu (Merkez aşım × ${ayarlar.bolge_katsayi_tl} TL/kg)`,
      tutar: h.merkezSoruHavuz,
    },
  ].filter((x) => x.tutar > 0);

  return (
    <div className="space-y-4">
      {/* Ay seçimi */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Ay:</label>
        <select
          value={secili}
          onChange={(e) => setSecili(e.target.value)}
          className={girdiSinif}
        >
          {aylar.map((a) => (
            <option key={`${a.yil}|${a.ay}`} value={`${a.yil}|${a.ay}`}>
              {a.ay} {a.yil}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAyarAcik((v) => !v)}
          className={girdiSinif + " text-neutral-600 dark:text-neutral-400"}
        >
          ⚙️ Prim Ayarları {ayarAcik ? "▲" : "▼"}
        </button>
        {durum?.ok && <span className="text-sm text-emerald-600">✓ {durum.ok}</span>}
        {durum?.hata && <span className="text-sm text-red-600">{durum.hata}</span>}
      </div>

      {/* Ayar paneli */}
      {ayarAcik && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 p-4">
          <form action={kaydetAction} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                  Eşikler & Katsayılar
                </p>
                {(
                  [
                    ["merkez_sube_hedef_kg", "Merkez şube başı hedef (kg)"],
                    ["merkez_taban_kg", "Merkez taban (kg) — altına düşmez"],
                    ["bolge1_sube_hedef_kg", "Bölge 1 şube başı hedef (kg)"],
                    ["bolge1_taban_kg", "Bölge 1 taban (kg)"],
                    ["bolge2_sube_hedef_kg", "Bölge 2 şube başı hedef (kg)"],
                    ["bolge2_taban_kg", "Bölge 2 taban (kg)"],
                    ["uretim_katsayi_tl", "Üretim primi katsayısı (TL/kg)"],
                    ["merkez_katsayi_tl", "Merkez primi katsayısı (TL/kg)"],
                    ["bolge_katsayi_tl", "Bölge primi katsayısı (TL/kg)"],
                  ] as const
                ).map(([key, etiket]) => (
                  <label key={key} className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-neutral-500 min-w-56">{etiket}</span>
                    <input
                      name={key}
                      type="number"
                      step="any"
                      defaultValue={ayarlar[key]}
                      readOnly={!duzenlenebilir}
                      className={girdiSinif + " w-28"}
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                  Dağıtım Oranları (%)
                </p>
                {(
                  [
                    ["Üretim havuzundan", "ud_merkez", "Merkez", ayarlar.uretim_dagilim.merkez],
                    ["", "ud_bolge", "Bölge", ayarlar.uretim_dagilim.bolge],
                    ["", "ud_uretim", "Üretim", ayarlar.uretim_dagilim.uretim],
                    ["Merkez havuzundan", "md_uretim", "Üretim", ayarlar.merkez_dagilim.uretim],
                    ["", "md_bolge", "Bölge", ayarlar.merkez_dagilim.bolge],
                    ["", "md_merkez", "Merkez", ayarlar.merkez_dagilim.merkez],
                    ["Bölge havuzundan", "bd_sorumlu", "Sorumlu", ayarlar.bolge_dagilim.sorumlu],
                    ["", "bd_merkez", "Merkez", ayarlar.bolge_dagilim.merkez],
                    ["", "bd_uretim", "Üretim", ayarlar.bolge_dagilim.uretim],
                  ] as const
                ).map(([baslik, key, etiket, deger]) => (
                  <div key={key}>
                    {baslik && (
                      <p className="text-[11px] text-neutral-500 mt-3 mb-1">{baslik} →</p>
                    )}
                    <label className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500 min-w-20">{etiket}</span>
                      <input
                        name={key}
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        defaultValue={Math.round(deger * 100)}
                        readOnly={!duzenlenebilir}
                        className={girdiSinif + " w-20"}
                      />
                      <span className="text-xs text-neutral-400">%</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                Sorumlular & Personel
              </p>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Bölge ayrımı şubenin <b>Merkez Yetkilisi</b> alanına bakar: aşağıdaki Bölge 2 adıyla
                eşleşen FR şubeler Bölge 2, kalan tüm FR şubeler Bölge 1 sayılır. Dağıtım bölgesi
                alanı bu ayrımda kullanılmaz.
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                {(
                  [
                    ["merkez_sorumlu_ad", "Merkez sorumlusu", ayarlar.merkez_sorumlu_ad],
                    ["bolge1_ad", "Bölge 1 sorumlusu", ayarlar.bolge1_ad],
                    ["bolge2_ad", "Bölge 2 sorumlusu", ayarlar.bolge2_ad],
                  ] as const
                ).map(([key, etiket, deger]) => (
                  <label key={key} className="block">
                    <span className="block text-xs text-neutral-500 mb-1">{etiket}</span>
                    <input
                      name={key}
                      defaultValue={deger}
                      readOnly={!duzenlenebilir}
                      className={girdiSinif + " w-full"}
                    />
                  </label>
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs text-neutral-500 mb-1">
                    Üretim personeli (her satır: Ad | Unvan)
                  </span>
                  <textarea
                    name="personel_uretim"
                    rows={5}
                    readOnly={!duzenlenebilir}
                    defaultValue={ayarlar.personel_uretim
                      .map((p) => `${p.ad} | ${p.unvan}`)
                      .join("\n")}
                    className={girdiSinif + " w-full font-mono text-xs"}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-neutral-500 mb-1">
                    Merkez / idari personel (her satır: Ad | Unvan)
                  </span>
                  <textarea
                    name="personel_merkez"
                    rows={6}
                    readOnly={!duzenlenebilir}
                    defaultValue={ayarlar.personel_merkez
                      .map((p) => `${p.ad} | ${p.unvan}`)
                      .join("\n")}
                    className={girdiSinif + " w-full font-mono text-xs"}
                  />
                </label>
              </div>
            </div>

            {duzenlenebilir && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={kaydetPending}
                  className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {kaydetPending ? "Kaydediliyor…" : "Ayarları Kaydet"}
                </button>
              </div>
            )}
          </form>

          {duzenlenebilir && (
            <form action={sifirlaAction} className="mt-2">
              <button type="submit" disabled={sifirlaPending} className={girdiSinif}>
                ↩ Word belgesindeki orijinal değerlere dön
              </button>
            </form>
          )}

          {!duzenlenebilir && (
            <p className="text-xs text-neutral-400 mt-2">
              Prim ayarlarını yalnızca admin ve genel müdür değiştirebilir.
            </p>
          )}
        </div>
      )}

      {/* Sonuç başlığı */}
      <div
        className={`rounded-xl border-2 px-4 py-3.5 text-center font-bold ${
          h.primYok
            ? "border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"
            : "border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
        }`}
      >
        {h.primYok ? (
          <>
            ❌ {ay} {yil} — şirket geneli hedef aşılmadı, prim hakkı oluşmadı
          </>
        ) : (
          <>
            ✅ {ay} {yil} — hedef aşıldı · Toplam prim: {fmt(toplamPrim)} TL
          </>
        )}
      </div>

      {/* Bölge kartları */}
      <div className="grid sm:grid-cols-2 gap-3">
        {bolgeKartlari.map((b) => (
          <div key={b.ad} className={kartSinif}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-2">
              {b.ad}
            </div>
            <div className="flex justify-between text-[13px] py-1 border-b border-neutral-100 dark:border-neutral-800">
              <span className="text-neutral-500">Fiili</span>
              <span className="font-semibold tabular-nums">{fmt(b.kg)} kg</span>
            </div>
            <div className="flex justify-between text-[13px] py-1 border-b border-neutral-100 dark:border-neutral-800">
              <span className="text-neutral-500">Hedef</span>
              <span className="font-semibold tabular-nums">{fmt(b.hedef)} kg</span>
            </div>
            <div className="flex justify-between text-[13px] py-1">
              <span className="text-neutral-500">Aşım</span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: b.asim > 0 ? "#16a34a" : "#dc2626" }}
              >
                {b.asim > 0 ? "+" : ""}
                {fmt(b.asim)} kg
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Hedef hesaplama detayı */}
      <div className={kartSinif + " overflow-x-auto"}>
        <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-3">
          Hedef Hesaplama Detayı
        </div>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase text-neutral-500">
            <tr className="border-b-2 border-neutral-200 dark:border-neutral-800">
              <th className="py-1.5 pr-3">Grup</th>
              <th className="py-1.5 px-3 text-right">Aktif şube</th>
              <th className="py-1.5 px-3 text-right">Şube başı</th>
              <th className="py-1.5 px-3 text-right">Hesaplanan</th>
              <th className="py-1.5 px-3 text-right">Taban</th>
              <th className="py-1.5 px-3 text-right">Kullanılan</th>
              <th className="py-1.5 pl-3">Durum</th>
            </tr>
          </thead>
          <tbody>
            {h.hedefDetay.map((d) => {
              const tabanUygulandi = d.ham < d.taban;
              return (
                <tr key={d.ad} className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="py-1.5 pr-3">{d.ad}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{d.subeSayisi}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{fmt(d.subeHedef)} kg</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-neutral-500">
                    {d.subeSayisi} × {fmt(d.subeHedef)} = {fmt(d.ham)}
                  </td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{fmt(d.taban)} kg</td>
                  <td className="py-1.5 px-3 text-right tabular-nums font-semibold">
                    {fmt(d.kullanilan)} kg
                  </td>
                  <td className="py-1.5 pl-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap ${
                        tabanUygulandi
                          ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
                          : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {tabanUygulandi ? "Taban uygulandı" : "Hesaplanan kullanıldı"}
                    </span>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-emerald-50 dark:bg-emerald-950/30 font-bold">
              <td className="py-2 pr-3" colSpan={5}>
                TOPLAM ŞİRKET HEDEFİ
              </td>
              <td className="py-2 px-3 text-right tabular-nums">{fmt(h.toplamHedef)} kg</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Havuzlar + kişi başı prim */}
      {!h.primYok && (
        <>
          <div className={kartSinif}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-2">
              Prim Havuzları
            </div>
            {havuzlar.map((x) => (
              <div
                key={x.ad}
                className="flex justify-between text-[13px] py-1.5 border-b border-neutral-100 dark:border-neutral-800 last:border-0 gap-4"
              >
                <span className="text-neutral-500">{x.ad}</span>
                <span className="font-semibold tabular-nums text-emerald-600">
                  {fmt(x.tutar)} TL
                </span>
              </div>
            ))}
          </div>

          <div className={kartSinif + " overflow-x-auto"}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-3">
              Kişi Başı Prim — {ay} {yil}
            </div>
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase text-neutral-500">
                <tr className="border-b-2 border-neutral-200 dark:border-neutral-800">
                  <th className="py-1.5 pr-3">Personel</th>
                  <th className="py-1.5 px-3">Unvan</th>
                  <th className="py-1.5 px-3">Grup</th>
                  <th className="py-1.5 pl-3 text-right">Prim (TL)</th>
                </tr>
              </thead>
              <tbody>
                {personel.map((p, i) => (
                  <tr
                    key={`${p.ad}-${i}`}
                    className="border-b border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="py-1.5 pr-3 font-medium">{p.ad}</td>
                    <td className="py-1.5 px-3 text-neutral-500">{p.unvan}</td>
                    <td className="py-1.5 px-3 text-[11px] text-neutral-400">{p.grup}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums font-bold text-emerald-600">
                      {fmt(p.prim)} TL
                    </td>
                  </tr>
                ))}
                <tr className="bg-emerald-50 dark:bg-emerald-950/30 font-bold">
                  <td className="py-2 pr-3" colSpan={3}>
                    TOPLAM
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    {fmt(toplamPrim)} TL
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-[11px] text-neutral-400 mt-3">
              * Bir bölge sorumlusunun tutarı düşükse kendi bölgesinde aşım olmamış, yalnızca
              şirket genel hedefinden aldığı pay gösteriliyor demektir.
            </p>
            {gizlenen > 0 && (
              <p className="text-[11px] text-neutral-400 mt-1">
                Bu listede yalnızca kendi priminiz görünüyor; {gizlenen} kişinin satırı
                gizlendi. TOPLAM satırı havuzun tamamını gösterir.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
