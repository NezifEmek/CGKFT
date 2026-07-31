"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import {
  gunlukKaydet,
  gunlukSil,
  kalemKaydet,
  kalemSil,
  excelIceAktar,
  type IceAktarSayfasi,
} from "./actions";
import {
  AYLAR_12,
  GELIR_ALANLARI,
  GIDER_ALANLARI,
  ggOzetle,
  gunlukGelir,
  gunlukGider,
  ayAdi,
  yilAl,
  sayfaAyristir,
  sayfaSubeTahmin,
  baskinDonem,
  type GunlukKayit,
  type Kalem,
} from "@/lib/merkez-gg";

const girdiSinif =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const kartSinif =
  "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4";

function tl(n: number): string {
  return Math.round(n).toLocaleString("tr-TR");
}
function yuzde(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export interface GGSube {
  id: string;
  ad: string;
  il: string;
}

type Sekme = "ozet" | "giris" | "excel";

export function GGArayuz({
  subeler,
  gunler,
  kalemler,
  yazabilir,
}: {
  subeler: GGSube[];
  gunler: GunlukKayit[];
  kalemler: Kalem[];
  yazabilir: boolean;
}) {
  const [sekme, setSekme] = useState<Sekme>("ozet");

  // Veride geçen dönemler (yıl-ay), takvim sırasında.
  const donemler = useMemo(() => {
    const set = new Set<string>();
    for (const g of gunler) set.add(`${yilAl(g.tarih)}|${ayAdi(g.tarih)}`);
    for (const k of kalemler) set.add(`${k.yil}|${k.ay}`);
    return [...set].sort((a, b) => {
      const [ya, aa] = a.split("|");
      const [yb, ab] = b.split("|");
      return Number(ya) - Number(yb) || AYLAR_12.indexOf(aa as never) - AYLAR_12.indexOf(ab as never);
    });
  }, [gunler, kalemler]);

  const [donemBas, setDonemBas] = useState(donemler[0] ?? "");
  const [donemBit, setDonemBit] = useState(donemler[donemler.length - 1] ?? "");
  const [ilGrupla, setIlGrupla] = useState(false);
  const [seciliSubeler, setSeciliSubeler] = useState<string[]>([]);

  const araliktaMi = (yil: number, ay: string) => {
    if (!donemBas || !donemBit) return true;
    const sira = (d: string) => {
      const [y, a] = d.split("|");
      return Number(y) * 12 + AYLAR_12.indexOf(a as never);
    };
    const s = Number(yil) * 12 + AYLAR_12.indexOf(ay as never);
    const a = Math.min(sira(donemBas), sira(donemBit));
    const b = Math.max(sira(donemBas), sira(donemBit));
    return s >= a && s <= b;
  };

  const aktifSubeler = seciliSubeler.length ? seciliSubeler : subeler.map((s) => s.id);

  const filtreliGunler = useMemo(
    () => gunler.filter((g) => aktifSubeler.includes(g.sube_id) && araliktaMi(yilAl(g.tarih), ayAdi(g.tarih))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gunler, aktifSubeler.join(","), donemBas, donemBit],
  );
  const filtreliKalemler = useMemo(
    () => kalemler.filter((k) => aktifSubeler.includes(k.sube_id) && araliktaMi(k.yil, k.ay)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kalemler, aktifSubeler.join(","), donemBas, donemBit],
  );

  const genel = ggOzetle(filtreliGunler, filtreliKalemler);
  const marj = genel.gelir ? (genel.net / genel.gelir) * 100 : 0;

  // Şube veya il bazlı satırlar
  const satirlar = useMemo(() => {
    const subeAd = new Map(subeler.map((s) => [s.id, s]));
    const grup = new Map<string, { ad: string; gelir: number; gider: number }>();
    const ekle = (anahtar: string, ad: string, gelir: number, gider: number) => {
      if (!grup.has(anahtar)) grup.set(anahtar, { ad, gelir: 0, gider: 0 });
      const x = grup.get(anahtar)!;
      x.gelir += gelir;
      x.gider += gider;
    };
    for (const g of filtreliGunler) {
      const s = subeAd.get(g.sube_id);
      const anahtar = ilGrupla ? s?.il || "—" : g.sube_id;
      ekle(anahtar, ilGrupla ? s?.il || "—" : s?.ad ?? g.sube_id, gunlukGelir(g), gunlukGider(g));
    }
    for (const k of filtreliKalemler) {
      const s = subeAd.get(k.sube_id);
      const anahtar = ilGrupla ? s?.il || "—" : k.sube_id;
      ekle(anahtar, ilGrupla ? s?.il || "—" : s?.ad ?? k.sube_id, 0, k.tutar || 0);
    }
    return [...grup.values()]
      .map((x) => ({ ...x, net: x.gelir - x.gider }))
      .sort((a, b) => b.net - a.net);
  }, [filtreliGunler, filtreliKalemler, ilGrupla, subeler]);

  const donemEtiket = (d: string) => {
    const [y, a] = d.split("|");
    return `${a} ${y}`;
  };

  const sekmeSinif = (aktif: boolean) =>
    `px-4 py-2.5 text-sm border-b-2 -mb-0.5 ${
      aktif
        ? "border-red-700 text-red-700 dark:text-red-400 font-semibold"
        : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex border-b-2 border-neutral-200 dark:border-neutral-800">
        <button type="button" onClick={() => setSekme("ozet")} className={sekmeSinif(sekme === "ozet")}>
          📊 Özet
        </button>
        {yazabilir && (
          <>
            <button
              type="button"
              onClick={() => setSekme("giris")}
              className={sekmeSinif(sekme === "giris")}
            >
              ✍️ Elle Giriş
            </button>
            <button
              type="button"
              onClick={() => setSekme("excel")}
              className={sekmeSinif(sekme === "excel")}
            >
              ⬆️ Excel İçe Aktar
            </button>
          </>
        )}
      </div>

      {sekme === "ozet" && (
        <>
          {!donemler.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
              Henüz gelir-gider verisi yok. <b>Elle Giriş</b> ile gün gün girebilir veya{" "}
              <b>Excel İçe Aktar</b> ile mevcut dosyanızı yükleyebilirsiniz. İki yol birbirini
              silmez.
            </div>
          ) : (
            <>
              {/* Filtreler */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-neutral-500">Dönem:</span>
                <select value={donemBas} onChange={(e) => setDonemBas(e.target.value)} className={girdiSinif}>
                  {donemler.map((d) => (
                    <option key={d} value={d}>
                      {donemEtiket(d)}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-neutral-400">—</span>
                <select value={donemBit} onChange={(e) => setDonemBit(e.target.value)} className={girdiSinif}>
                  {donemler.map((d) => (
                    <option key={d} value={d}>
                      {donemEtiket(d)}
                    </option>
                  ))}
                </select>

                <select
                  value={seciliSubeler.length === 1 ? seciliSubeler[0] : ""}
                  onChange={(e) => setSeciliSubeler(e.target.value ? [e.target.value] : [])}
                  className={girdiSinif}
                >
                  <option value="">Tüm şubeler ({subeler.length})</option>
                  {subeler.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ad}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIlGrupla((v) => !v)}
                  className={`${girdiSinif} ${ilGrupla ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900" : ""}`}
                >
                  İl bazlı grupla
                </button>
              </div>

              {/* Özet kartları */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { s: tl(genel.gelir), e: "Toplam Gelir (TL)", c: "#16a34a" },
                  { s: tl(genel.gider), e: "Toplam Gider (TL)", c: "#c0392b" },
                  { s: tl(genel.net), e: "Net Kâr/Zarar (TL)", c: genel.net >= 0 ? "#16a34a" : "#c0392b" },
                  { s: yuzde(marj) + "%", e: "Kâr Marjı", c: "" },
                ].map((k) => (
                  <div key={k.e} className={kartSinif + " text-center"}>
                    <div className="text-xl font-extrabold" style={{ color: k.c || undefined }}>
                      {k.s}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-1">{k.e}</div>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-neutral-400">
                Gelir = {GELIR_ALANLARI.map((a) => a.etiket).join(" + ")} · Gider ={" "}
                {GIDER_ALANLARI.map((a) => a.etiket).join(" + ")} + aylık stok/gider kalemleri (
                {tl(genel.kalemGideri)} TL) · {genel.gunSayisi} gün kaydı
              </p>

              {/* Tablo */}
              <div className={kartSinif + " overflow-x-auto"}>
                <table className="w-full text-[13px]">
                  <thead className="text-[11px] uppercase text-neutral-500">
                    <tr className="border-b-2 border-neutral-200 dark:border-neutral-800">
                      <th className="px-2 py-2 text-left">{ilGrupla ? "İl" : "Şube"}</th>
                      <th className="px-2 py-2 text-right">Gelir</th>
                      <th className="px-2 py-2 text-right">Gider</th>
                      <th className="px-2 py-2 text-right">Net</th>
                      <th className="px-2 py-2 text-right">Marj</th>
                    </tr>
                  </thead>
                  <tbody>
                    {satirlar.map((s) => (
                      <tr key={s.ad} className="border-b border-neutral-100 dark:border-neutral-800">
                        <td className="px-2 py-2 font-medium">{s.ad}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{tl(s.gelir)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{tl(s.gider)}</td>
                        <td
                          className="px-2 py-2 text-right tabular-nums font-bold"
                          style={{ color: s.net >= 0 ? "#16a34a" : "#dc2626" }}
                        >
                          {tl(s.net)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {s.gelir ? yuzde((s.net / s.gelir) * 100) : "0,0"}%
                        </td>
                      </tr>
                    ))}
                    {!satirlar.length && (
                      <tr>
                        <td colSpan={5} className="px-2 py-8 text-center text-neutral-400">
                          Seçilen dönemde kayıt yok.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {sekme === "giris" && yazabilir && (
        <ElleGiris subeler={subeler} gunler={gunler} kalemler={kalemler} />
      )}

      {sekme === "excel" && yazabilir && <ExcelAktar subeler={subeler} />}
    </div>
  );
}

// ─── Elle giriş ─────────────────────────────────────────────────────────────

function ElleGiris({
  subeler,
  gunler,
  kalemler,
}: {
  subeler: GGSube[];
  gunler: GunlukKayit[];
  kalemler: Kalem[];
}) {
  const [gunDurum, gunAction, gunPending] = useActionState(gunlukKaydet, null);
  const [silDurum, silAction, silPending] = useActionState(gunlukSil, null);
  const [kalemDurum, kalemAction, kalemPending] = useActionState(kalemKaydet, null);
  const [kalemSilDurum, kalemSilAction, kalemSilPending] = useActionState(kalemSil, null);

  const [subeId, setSubeId] = useState(subeler[0]?.id ?? "");
  const bugun = new Date().toISOString().slice(0, 10);
  const [tarih, setTarih] = useState(bugun);

  const durum = gunDurum ?? silDurum ?? kalemDurum ?? kalemSilDurum;

  // Seçili şubenin son kayıtları — aynı günü iki kez girmeyi fark etmek için.
  const subeGunleri = useMemo(
    () =>
      gunler
        .filter((g) => g.sube_id === subeId)
        .sort((a, b) => (a.tarih < b.tarih ? 1 : -1))
        .slice(0, 12),
    [gunler, subeId],
  );
  const mevcut = subeGunleri.find((g) => g.tarih === tarih);

  const subeKalemleri = useMemo(
    () =>
      kalemler
        .filter((k) => k.sube_id === subeId)
        .sort((a, b) => b.yil - a.yil || AYLAR_12.indexOf(b.ay as never) - AYLAR_12.indexOf(a.ay as never)),
    [kalemler, subeId],
  );

  return (
    <div className="space-y-4">
      <div className={kartSinif + " space-y-3"}>
        <h3 className="font-medium text-sm">Günlük Gelir-Gider</h3>
        <form action={gunAction} className="space-y-3">
          <input type="hidden" name="sube_id" value={subeId} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Şube *</span>
              <select
                value={subeId}
                onChange={(e) => setSubeId(e.target.value)}
                className={girdiSinif + " w-full"}
              >
                {subeler.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ad}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Tarih *</span>
              <input
                name="tarih"
                type="date"
                required
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                className={girdiSinif + " w-full"}
              />
            </label>
          </div>

          {mevcut && (
            <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              Bu güne ait kayıt var ({mevcut.kaynak === "excel" ? "Excel'den" : "elle"} girilmiş,
              net {tl(gunlukGelir(mevcut) - gunlukGider(mevcut))} TL). Kaydederseniz üzerine yazılır.
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-1.5">
              Gelir
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {GELIR_ALANLARI.map((a) => (
                <label key={a.key} className="block">
                  <span className="block text-xs text-neutral-500 mb-1">{a.etiket}</span>
                  <input
                    name={a.key}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={mevcut ? String(mevcut[a.key] ?? 0) : ""}
                    key={`${subeId}-${tarih}-${a.key}`}
                    placeholder="0"
                    className={girdiSinif + " w-full"}
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-400 mb-1.5">
              Gider
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {GIDER_ALANLARI.map((a) => (
                <label key={a.key} className="block">
                  <span className="block text-xs text-neutral-500 mb-1">{a.etiket}</span>
                  <input
                    name={a.key}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={mevcut ? String(mevcut[a.key] ?? 0) : ""}
                    key={`${subeId}-${tarih}-${a.key}`}
                    placeholder="0"
                    className={girdiSinif + " w-full"}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={gunPending || !subeId}
              className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {gunPending ? "Kaydediliyor…" : mevcut ? "Günü güncelle" : "Günü kaydet"}
            </button>
            {durum?.ok && <span className="text-sm text-emerald-600">✓ {durum.ok}</span>}
            {durum?.hata && <span className="text-sm text-red-600">{durum.hata}</span>}
          </div>
        </form>
      </div>

      {/* Son günler */}
      <div className={kartSinif + " overflow-x-auto"}>
        <h3 className="font-medium text-sm mb-3">Bu şubenin son kayıtları</h3>
        <table className="w-full text-[13px]">
          <thead className="text-[11px] uppercase text-neutral-500">
            <tr className="border-b-2 border-neutral-200 dark:border-neutral-800">
              <th className="px-2 py-2 text-left">Tarih</th>
              <th className="px-2 py-2 text-right">Gelir</th>
              <th className="px-2 py-2 text-right">Gider</th>
              <th className="px-2 py-2 text-right">Net</th>
              <th className="px-2 py-2 text-left">Kaynak</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {subeGunleri.map((g) => (
              <tr key={g.id} className="border-b border-neutral-100 dark:border-neutral-800">
                <td className="px-2 py-1.5 tabular-nums">{g.tarih}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{tl(gunlukGelir(g))}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{tl(gunlukGider(g))}</td>
                <td
                  className="px-2 py-1.5 text-right tabular-nums font-semibold"
                  style={{ color: gunlukGelir(g) - gunlukGider(g) >= 0 ? "#16a34a" : "#dc2626" }}
                >
                  {tl(gunlukGelir(g) - gunlukGider(g))}
                </td>
                <td className="px-2 py-1.5 text-[11px] text-neutral-400">
                  {g.kaynak === "excel" ? "Excel" : "elle"}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <form action={silAction}>
                    <input type="hidden" name="kayit_id" value={g.id} />
                    <button
                      type="submit"
                      disabled={silPending}
                      title="Bu günü sil"
                      className="text-red-600 hover:underline text-xs disabled:opacity-60"
                    >
                      🗑
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!subeGunleri.length && (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-center text-neutral-400">
                  Bu şube için kayıt yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Aylık kalemler */}
      <div className={kartSinif + " space-y-3"}>
        <h3 className="font-medium text-sm">Aylık Stok / Gider Kalemleri</h3>
        <p className="text-[11px] text-neutral-400">
          Bu kalemlerin tamamı gidere eklenir (eski panelde de böyleydi).
        </p>
        <form action={kalemAction} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <input type="hidden" name="sube_id" value={subeId} />
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Yıl</span>
            <input
              name="yil"
              type="number"
              defaultValue={new Date().getFullYear()}
              className={girdiSinif + " w-full"}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Ay</span>
            <select name="ay" defaultValue={AYLAR_12[new Date().getMonth()]} className={girdiSinif + " w-full"}>
              {AYLAR_12.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Ürün / kalem</span>
            <input name="urun" required className={girdiSinif + " w-full"} />
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Adet</span>
            <input name="adet" type="number" step="0.01" min="0" className={girdiSinif + " w-full"} />
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Tutar (TL)</span>
            <input name="tutar" type="number" step="0.01" min="0" className={girdiSinif + " w-full"} />
          </label>
          <div className="col-span-full">
            <button
              type="submit"
              disabled={kalemPending}
              className={girdiSinif + " disabled:opacity-60"}
            >
              {kalemPending ? "Ekleniyor…" : "＋ Kalem ekle"}
            </button>
          </div>
        </form>

        {subeKalemleri.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-[11px] uppercase text-neutral-500">
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="px-2 py-1.5 text-left">Dönem</th>
                  <th className="px-2 py-1.5 text-left">Kalem</th>
                  <th className="px-2 py-1.5 text-right">Adet</th>
                  <th className="px-2 py-1.5 text-right">Tutar</th>
                  <th className="px-2 py-1.5 text-left">Kaynak</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {subeKalemleri.slice(0, 30).map((k) => (
                  <tr key={k.id} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="px-2 py-1.5 text-neutral-500">
                      {k.ay} {k.yil}
                    </td>
                    <td className="px-2 py-1.5">{k.urun}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{k.adet}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{tl(k.tutar)}</td>
                    <td className="px-2 py-1.5 text-[11px] text-neutral-400">
                      {k.kaynak === "excel" ? "Excel" : "elle"}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <form action={kalemSilAction}>
                        <input type="hidden" name="kalem_id" value={k.id} />
                        <button
                          type="submit"
                          disabled={kalemSilPending}
                          className="text-red-600 hover:underline text-xs disabled:opacity-60"
                        >
                          🗑
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Excel içe aktarma ──────────────────────────────────────────────────────

interface OnizlemeSatiri {
  sayfaAdi: string;
  ay: string | null;
  yil: number;
  subeId: string;
  gunluk: Omit<GunlukKayit, "sube_id">[];
  kalemler: { urun: string; adet: number; tutar: number }[];
}

function ExcelAktar({ subeler }: { subeler: GGSube[] }) {
  const [onizleme, setOnizleme] = useState<OnizlemeSatiri[] | null>(null);
  const [dosyaAdi, setDosyaAdi] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<string | null>(null);
  const [ilerleme, setIlerleme] = useState("");
  const [gonderiliyor, gonder] = useTransition();
  const dosyaRef = useRef<HTMLInputElement>(null);

  async function dosyaOku(file: File) {
    setHata(null);
    setSonuc(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const satirlar: OnizlemeSatiri[] = [];

      for (const sayfaAdi of wb.SheetNames) {
        const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sayfaAdi], {
          header: 1,
          blankrows: false,
          defval: null,
        });
        const parsed = sayfaAyristir(grid);
        if (!parsed || !parsed.gunluk.length) continue;

        // Günleri sayfa adının ayına göre ELEMİYORUZ: gerçek dosyada ay bilgisi
        // sayfa adında değil dosya adında ve tablolar önceki ayın son günleriyle
        // başlıyor (ör. 27–30 Nisan + Mayıs). Günlük kayıtlar zaten gerçek
        // tarihle saklandığı için her gün kendi ayına yazılır. Dönem etiketi
        // yalnızca aylık kalemler için gerekiyor; onu baskın aydan alıyoruz.
        const donem = baskinDonem(parsed.gunluk);
        if (!donem) continue;

        satirlar.push({
          sayfaAdi,
          ay: donem.ay,
          yil: donem.yil,
          subeId:
            sayfaSubeTahmin(
              sayfaAdi,
              subeler.map((s) => ({ ...s, tip: "MS" })),
              grid[0]?.[0],
            ) ?? "",
          gunluk: parsed.gunluk,
          kalemler: parsed.kalemler,
        });
      }

      if (!satirlar.length) {
        setHata("Dosyada okunabilir günlük tablo bulunamadı.");
        setOnizleme(null);
        return;
      }
      setDosyaAdi(file.name);
      setOnizleme(satirlar);
    } catch (e) {
      setHata("Dosya okunamadı: " + (e instanceof Error ? e.message : "bilinmeyen hata"));
      setOnizleme(null);
    }
  }

  function aktar() {
    if (!onizleme) return;
    const secili: IceAktarSayfasi[] = onizleme
      .filter((s) => s.subeId && s.ay)
      .map((s) => ({
        subeId: s.subeId,
        yil: s.yil,
        ay: s.ay!,
        gunluk: s.gunluk.map((g) => ({
          tarih: g.tarih,
          nakit: g.nakit,
          kredi_karti: g.kredi_karti,
          ticket: g.ticket,
          yemek_sepeti: g.yemek_sepeti,
          ayran: g.ayran,
          yemek: g.yemek,
          genel_masraf: g.genel_masraf,
        })),
        kalemler: s.kalemler,
      }));

    if (!secili.length) {
      setHata("Hiçbir sayfa için şube seçilmemiş.");
      return;
    }

    // Sayfaları TEK TEK gönderiyoruz. Hepsini tek istekte yazmak 25 sayfalık
    // gerçek dosyada sunucu zaman aşımına takılıyordu ve aktarım sessizce
    // ilk 9 şubede kalıyordu. Sayfa başına bir istek hem sınıra takılmıyor
    // hem de nerede kaldığı görülebiliyor.
    gonder(async () => {
      let gun = 0;
      let kalem = 0;
      for (let i = 0; i < secili.length; i++) {
        setIlerleme(`${i + 1} / ${secili.length} sayfa aktarılıyor…`);
        const r = await excelIceAktar([secili[i]]);
        if (r.hata) {
          setHata(`${i + 1}. sayfada durdu: ${r.hata} — önceki ${i} sayfa aktarıldı.`);
          setIlerleme("");
          return;
        }
        gun += r.gunSayisi ?? 0;
        kalem += r.kalemSayisi ?? 0;
      }
      setIlerleme("");
      setSonuc(`İçe aktarıldı: ${secili.length} şube/ay, ${gun} gün, ${kalem} kalem`);
      setOnizleme(null);
      if (dosyaRef.current) dosyaRef.current.value = "";
    });
  }

  return (
    <div className="space-y-4">
      <div className={kartSinif}>
        <h3 className="font-medium text-sm mb-2">Excel İçe Aktar</h3>
        <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
          Eski paneldeki <b>&quot;TÜM MERKEZ ŞUBELER&quot;</b> formatı: her sayfası bir şube + bir
          ay, günlük Nakit / Kredi Kartı / Ticket / Yemek Sepeti / Ayran / Yemek / G.Masraf tablosu
          ve yanında <b>STOK HAREKETLERİ</b> kalem listesi. Sayfa adından şube ve ay tahmin edilir,
          aşağıda düzeltebilirsiniz.
        </p>
        <input
          ref={dosyaRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) dosyaOku(f);
          }}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 dark:file:bg-neutral-100 file:text-white dark:file:text-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium"
        />
        <div className="mt-3 rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
          İçe aktarma <b>gün bazında günceller</b>: Excel&apos;de bulunmayan bir güne elle
          girdiğiniz kayıt silinmez. Elle eklediğiniz aylık kalemler de korunur.
        </div>
        {hata && <p className="text-sm text-red-600 mt-3">{hata}</p>}
        {sonuc && <p className="text-sm text-emerald-600 mt-3">✓ {sonuc}</p>}
      </div>

      {onizleme && (
        <div className={kartSinif}>
          <p className="text-sm mb-3">
            <b>{dosyaAdi}</b>: {onizleme.length} sayfa okundu. Şube ve ay eşleşmesini kontrol edin.
          </p>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-[13px]">
              <thead className="text-[11px] uppercase text-neutral-500 sticky top-0 bg-white dark:bg-neutral-900">
                <tr className="border-b-2 border-neutral-200 dark:border-neutral-800">
                  <th className="px-2 py-2 text-left">Sayfa</th>
                  <th className="px-2 py-2 text-left">Ay / Yıl</th>
                  <th className="px-2 py-2 text-left">Şube</th>
                  <th className="px-2 py-2 text-right">Gün</th>
                  <th className="px-2 py-2 text-right">Kalem</th>
                </tr>
              </thead>
              <tbody>
                {onizleme.map((s, i) => (
                  <tr key={s.sayfaAdi + i} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="px-2 py-1.5 font-mono text-[11px]">{s.sayfaAdi}</td>
                    <td className="px-2 py-1.5">
                      <span className={s.ay ? "" : "text-red-600"}>
                        {s.ay ?? "ay bulunamadı"} {s.yil}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={s.subeId}
                        onChange={(e) =>
                          setOnizleme((o) =>
                            o!.map((x, j) => (j === i ? { ...x, subeId: e.target.value } : x)),
                          )
                        }
                        className={girdiSinif + " min-w-44"}
                      >
                        <option value="">— Atla —</option>
                        {subeler.map((sb) => (
                          <option key={sb.id} value={sb.id}>
                            {sb.ad}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{s.gunluk.length}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{s.kalemler.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={aktar}
              disabled={gonderiliyor}
              className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {gonderiliyor ? ilerleme || "Aktarılıyor…" : "Seçilenleri içe aktar"}
            </button>
            <button type="button" onClick={() => setOnizleme(null)} className={girdiSinif}>
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
