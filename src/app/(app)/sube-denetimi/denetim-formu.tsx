"use client";

import { useActionState, useMemo, useState } from "react";
import { denetimKaydet } from "./actions";
import {
  KATEGORILER,
  CEVAP_ETIKETLERI,
  DENETIM_TURLERI,
  MAX_PUAN,
  SORU_SAYISI,
  grupBul,
  skorHesapla,
} from "@/lib/denetim-sorulari";

export interface FormSube {
  id: string;
  ad: string;
  bolge: string;
  il: string;
  ilce: string;
}

const girdiSinif =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";

export function DenetimFormu({ subeler, adSoyad }: { subeler: FormSube[]; adSoyad: string }) {
  const [durum, action, pending] = useActionState(denetimKaydet, null);

  const [bolge, setBolge] = useState("");
  const [il, setIl] = useState("");
  const [ilce, setIlce] = useState("");
  const [subeId, setSubeId] = useState("");
  const [cevaplar, setCevaplar] = useState<Record<string, number>>({});

  const bolgeler = useMemo(
    () => [...new Set(subeler.map((s) => s.bolge).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")),
    [subeler],
  );
  const iller = useMemo(
    () =>
      [...new Set(subeler.filter((s) => !bolge || s.bolge === bolge).map((s) => s.il).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "tr"),
      ),
    [subeler, bolge],
  );
  const ilceler = useMemo(
    () =>
      [
        ...new Set(
          subeler
            .filter((s) => (!bolge || s.bolge === bolge) && (!il || s.il === il))
            .map((s) => s.ilce)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "tr")),
    [subeler, bolge, il],
  );
  const secilebilir = useMemo(
    () =>
      subeler
        .filter(
          (s) =>
            (!bolge || s.bolge === bolge) && (!il || s.il === il) && (!ilce || s.ilce === ilce),
        )
        .sort((a, b) => a.ad.localeCompare(b.ad, "tr")),
    [subeler, bolge, il, ilce],
  );

  const skor = skorHesapla(cevaplar);
  const grup = grupBul(skor.puan100);
  const tamamMi = skor.cevaplanmis === SORU_SAYISI;

  function cevapla(soruId: string, puan: number) {
    setCevaplar((c) => ({ ...c, [soruId]: puan }));
  }

  function formuSifirla() {
    setCevaplar({});
    setSubeId("");
  }

  return (
    <form action={action} className="space-y-4">
      {/* Şube seçimi */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <h3 className="font-medium text-sm mb-3">Denetim Bilgileri</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Bölge</span>
            <select
              value={bolge}
              onChange={(e) => {
                setBolge(e.target.value);
                setIl("");
                setIlce("");
                setSubeId("");
              }}
              className={girdiSinif + " w-full"}
            >
              <option value="">Tümü</option>
              {bolgeler.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">İl</span>
            <select
              value={il}
              onChange={(e) => {
                setIl(e.target.value);
                setIlce("");
                setSubeId("");
              }}
              className={girdiSinif + " w-full"}
            >
              <option value="">Tümü</option>
              {iller.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">İlçe</span>
            <select
              value={ilce}
              onChange={(e) => {
                setIlce(e.target.value);
                setSubeId("");
              }}
              className={girdiSinif + " w-full"}
            >
              <option value="">Tümü</option>
              {ilceler.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Şube *</span>
            <select
              name="sube_id"
              required
              value={subeId}
              onChange={(e) => setSubeId(e.target.value)}
              className={girdiSinif + " w-full"}
            >
              <option value="">Şube seç…</option>
              {secilebilir.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ad}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Tarih</span>
            <input
              name="tarih"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={girdiSinif + " w-full"}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Denetim Türü</span>
            <select name="tur" defaultValue="Periyodik" className={girdiSinif + " w-full"}>
              {DENETIM_TURLERI.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-neutral-500 mb-1">Denetleyen</span>
            <input
              name="denetleyen"
              defaultValue={adSoyad}
              className={girdiSinif + " w-full"}
            />
          </label>
        </div>
      </div>

      {/* Canlı skor */}
      <div
        className="rounded-xl border-2 bg-white dark:bg-neutral-900 p-4 flex items-center justify-between gap-4 flex-wrap sticky top-2 z-10"
        style={{ borderColor: grup.renk }}
      >
        <div>
          <div className="text-xs text-neutral-500">Anlık Puan</div>
          <div className="text-3xl font-bold" style={{ color: grup.renk }}>
            {skor.puan100}
            <span className="text-base font-medium text-neutral-500">/100</span>
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            Ham: {skor.toplam}/{MAX_PUAN}
          </div>
        </div>
        <div className="text-center">
          <span
            className="inline-block px-3 py-1 rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: grup.renk }}
          >
            {grup.ad} · {grup.etiket}
          </span>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${tamamMi ? "text-emerald-600" : "text-amber-600"}`}>
            {skor.cevaplanmis} / {SORU_SAYISI} soru
          </div>
          {!tamamMi && (
            <div className="text-[11px] text-neutral-500">
              Cevaplanmayan sorular 0 puan sayılır
            </div>
          )}
        </div>
      </div>

      {/* Kategoriler */}
      {KATEGORILER.map((kat) => {
        const bp = skor.bolumPuanlar[kat.id] ?? 0;
        const oran = kat.max ? (bp / kat.max) * 100 : 0;
        return (
          <div
            key={kat.id}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-3">
              <h3 className="font-medium text-sm">
                {kat.ikon} {kat.ad}
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${oran}%`, backgroundColor: grup.renk }}
                  />
                </div>
                <span className="text-xs text-neutral-500 tabular-nums">
                  {bp}/{kat.max}
                </span>
              </div>
            </div>

            <div>
              {kat.sorular.map((soru, i) => (
                <div
                  key={soru.id}
                  className="px-4 py-2.5 border-b border-neutral-50 dark:border-neutral-800/50 last:border-0 flex items-start justify-between gap-4 flex-wrap"
                >
                  <span className="text-[13px] flex-1 min-w-56">
                    <span className="text-neutral-400 mr-1.5">{i + 1}.</span>
                    {soru.metin}
                  </span>
                  <div className="flex gap-1.5 shrink-0">
                    {[1, 2, 3].map((p) => {
                      const seciliMi = cevaplar[soru.id] === p;
                      return (
                        <label
                          key={p}
                          className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs whitespace-nowrap transition-colors ${
                            seciliMi
                              ? "border-transparent text-white font-semibold"
                              : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          }`}
                          style={
                            seciliMi
                              ? {
                                  backgroundColor:
                                    p === 3 ? "#16a34a" : p === 2 ? "#f59e0b" : "#ef4444",
                                }
                              : undefined
                          }
                        >
                          <input
                            type="radio"
                            name={`soru_${soru.id}`}
                            value={p}
                            checked={seciliMi}
                            onChange={() => cevapla(soru.id, p)}
                            className="sr-only"
                          />
                          {p} {CEVAP_ETIKETLERI[p]}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Not + kaydet */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <label className="block">
          <span className="block text-xs text-neutral-500 mb-1">Genel Not</span>
          <textarea
            name="notlar"
            rows={3}
            placeholder="Denetimde öne çıkan gözlemler, verilen talimatlar…"
            className={girdiSinif + " w-full"}
          />
        </label>

        <div className="flex items-center gap-3 mt-3">
          <button
            type="submit"
            disabled={pending || !subeId}
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Kaydediliyor…" : "Denetimi Kaydet"}
          </button>
          <button type="button" onClick={formuSifirla} className={girdiSinif}>
            Formu Temizle
          </button>
          {durum?.ok && <span className="text-sm text-emerald-600">Kaydedildi ✓</span>}
          {durum?.hata && <span className="text-sm text-red-600">{durum.hata}</span>}
        </div>
      </div>
    </form>
  );
}
