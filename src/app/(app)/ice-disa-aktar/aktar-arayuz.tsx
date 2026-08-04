"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { satislariAktar, donemSatislariniSil, type AktarilacakSatir } from "./actions";
import { satislariCoz } from "@/lib/satis-aktarim";
import { AYLAR_12 } from "@/types/database";

export interface AktarSube {
  id: string;
  ad: string;
  kod: string;
  bolge: string;
  tip: "MS" | "FR";
  il: string;
  ilce: string;
}

export interface AktarSatis {
  sube_id: string;
  yil: number;
  ay: string;
  kg: number;
}

function dosyaIndir(icerik: Blob, ad: string) {
  const url = URL.createObjectURL(icerik);
  const a = document.createElement("a");
  a.href = url;
  a.download = ad;
  a.click();
  URL.revokeObjectURL(url);
}

const dugmeSinif =
  "rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800";

const gir =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";

interface Onizleme {
  satirlar: AktarilacakSatir[];
  eslesmeyen: string[];
  aylar: string[];
  yillar: number[];
  notlar: string[];
  bicim: string;
  toplamKg: number;
  dosyaAdi: string;
}

export function AktarArayuz({
  subeler,
  satislar,
  aylar,
  varsayilanYil,
  yazabilir,
  yonetimMi,
}: {
  subeler: AktarSube[];
  satislar: AktarSatis[];
  aylar: { yil: number; ay: string; gun_sayisi: number }[];
  varsayilanYil: number;
  yazabilir: boolean;
  /** Dönem silme yetkisi — geri alınamaz işlem */
  yonetimMi: boolean;
}) {
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  // ── Dönem silme ───────────────────────────────────────────────────────
  const [silYil, setSilYil] = useState(varsayilanYil);
  const [silAy, setSilAy] = useState<string>(AYLAR_12[0]);
  const [silmeSonuc, setSilmeSonuc] = useState<string | null>(null);

  const silYillari = [...new Set([varsayilanYil, ...satislar.map((s) => s.yil)])].sort(
    (a, b) => b - a,
  );
  const silinecekler = satislar.filter((s) => s.yil === silYil && s.ay === silAy);
  const silinecekSayi = silinecekler.length;
  const silinecekKg = silinecekler.reduce((t, s) => t + (Number(s.kg) || 0), 0);

  function donemiSil() {
    const ayAdi = silAy.charAt(0) + silAy.slice(1).toLocaleLowerCase("tr");
    if (
      !window.confirm(
        `${ayAdi} ${silYil} dönemindeki ${silinecekSayi} şube kaydı ` +
          `(${silinecekKg.toLocaleString("tr-TR")} kg) silinecek.\n\n` +
          `Başka ay ve yıllara dokunulmayacak. Emin misiniz?`,
      )
    ) {
      return;
    }
    basla(async () => {
      const r = await donemSatislariniSil(silYil, silAy);
      setSilmeSonuc(
        r.hata
          ? r.hata
          : `✓ ${ayAdi} ${silYil}: ${r.silinen} kayıt silindi. Sayfayı yenileyin.`,
      );
    });
  }

  const yilAylari = [...new Set(aylar.filter((a) => a.yil === varsayilanYil).map((a) => a.ay))].sort(
    (a, b) => AYLAR_12.indexOf(a as never) - AYLAR_12.indexOf(b as never),
  );

  // ── Dışa aktarma ────────────────────────────────────────────────────────
  function jsonYedekIndir() {
    const veri = { olusturma: new Date().toISOString(), subeler, aylar, satislar };
    dosyaIndir(
      new Blob([JSON.stringify(veri, null, 2)], { type: "application/json" }),
      `cigkofte-yedek-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }

  /** Şube × ay kg tablosu üretir (boşSablon=true ise kg hücreleri boş gelir). */
  function kgTablosu(bosSablon: boolean) {
    const kgMap = new Map<string, number>();
    for (const s of satislar) kgMap.set(`${s.sube_id}|${s.yil}|${s.ay}`, s.kg);

    return subeler.map((s) => {
      const satir: Record<string, string | number> = {
        Kod: s.kod,
        Şube: s.ad,
        Bölge: s.bolge,
        Tip: s.tip === "MS" ? "MŞ" : "FR",
        İl: s.il,
        İlçe: s.ilce,
      };
      for (const ay of yilAylari) {
        satir[ay] = bosSablon ? "" : (kgMap.get(`${s.id}|${varsayilanYil}|${ay}`) ?? "");
      }
      return satir;
    });
  }

  function excelIndir(bosSablon: boolean) {
    const ws = XLSX.utils.json_to_sheet(kgTablosu(bosSablon));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${varsayilanYil} kg`);
    const cikti = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    dosyaIndir(
      new Blob([cikti], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      bosSablon ? `bos-sablon-${varsayilanYil}.xlsx` : `satislar-${varsayilanYil}.xlsx`,
    );
  }

  // ── İçe aktarma ─────────────────────────────────────────────────────────
  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setHata(null);
    setSonuc(null);
    setOnizleme(null);

    try {
      const buf = await dosya.arrayBuffer();
      // cellDates kapalı: tarihler ham seri numarası olarak gelsin
      // (bkz. @/lib/excel-tarih — saat dilimi kayması sorunu).
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Dosyada sayfa bulunamadı.");

      // header:1 ile ham ızgara okunuyor. Nesne olarak okumak, başlığı
      // sayı olan sütunlarda ("46204") ve yinelenen başlıklarda sorun
      // çıkarıyordu.
      const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        blankrows: false,
        defval: null,
        raw: true,
      });

      const c = satislariCoz(grid, subeler, varsayilanYil);
      if (!c.satirlar.length) {
        throw new Error(
          "Dosya tanındı ama yazılacak satır çıkmadı — hiçbir şube eşleşmedi ya da " +
            "miktar sütunu boş." +
            (c.eslesmeyen.length ? ` Eşleşmeyen kodlar: ${c.eslesmeyen.slice(0, 5).join(", ")}` : ""),
        );
      }

      setOnizleme({
        satirlar: c.satirlar,
        eslesmeyen: c.eslesmeyen,
        aylar: c.aylar,
        yillar: c.yillar,
        notlar: c.notlar,
        bicim: c.bicim,
        toplamKg: c.satirlar.reduce((t, s) => t + s.kg, 0),
        dosyaAdi: dosya.name,
      });
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Dosya okunamadı.");
    } finally {
      e.target.value = "";
    }
  }

  function aktarimiOnayla() {
    if (!onizleme) return;
    basla(async () => {
      const r = await satislariAktar(onizleme.satirlar);
      if (r.hata) {
        setHata(r.hata);
        setSonuc(null);
      } else {
        setHata(null);
        setSonuc(
          `${r.yazilan} kayıt aktarıldı.` +
            (r.eklenenAy ? ` ${r.eklenenAy} yeni ay tanımı eklendi.` : ""),
        );
        setOnizleme(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Dışa aktarma */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <h3 className="font-medium text-sm mb-1">Dışa Aktar</h3>
        <p className="text-xs text-neutral-500 mb-3">
          {varsayilanYil} yılı için {yilAylari.length} ay · {subeler.length} şube
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => excelIndir(false)} className={dugmeSinif}>
            📊 Satışları Excel indir
          </button>
          <button type="button" onClick={() => excelIndir(true)} className={dugmeSinif}>
            📄 Boş şablon indir
          </button>
          <button type="button" onClick={jsonYedekIndir} className={dugmeSinif}>
            💾 JSON yedek indir
          </button>
        </div>
      </div>

      {/* İçe aktarma */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <h3 className="font-medium text-sm mb-1">İçe Aktar (Excel)</h3>
        <p className="text-xs text-neutral-500 mb-3">
          Boş şablonu doldurup buradan yükleyin. Şubeler <b>Kod</b> ya da <b>Şube</b> sütunundan
          eşleştirilir; ay sütunlarındaki dolu hücreler {varsayilanYil} yılına yazılır. Boş
          bırakılan hücrelere dokunulmaz.
        </p>

        {yazabilir ? (
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={dosyaSecildi}
            className="block text-sm file:mr-3 file:rounded-md file:border file:border-neutral-300 dark:file:border-neutral-700 file:bg-transparent file:px-3 file:py-1.5 file:text-sm"
          />
        ) : (
          <p className="text-sm text-neutral-500">İçe aktarma yetkiniz yok.</p>
        )}

        {hata && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 text-sm text-red-800 dark:text-red-300">
            {hata}
          </div>
        )}
        {sonuc && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-3 text-sm text-emerald-800 dark:text-emerald-300">
            ✓ {sonuc}
          </div>
        )}

        {onizleme && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3">
            <div className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
              Önizleme — {onizleme.dosyaAdi}
            </div>
            <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-0.5">
              <li>
                <b>{onizleme.satirlar.length}</b> şube kaydı ·{" "}
                <b>{onizleme.toplamKg.toLocaleString("tr-TR")} kg</b>
              </li>
              <li>
                Dönem: {onizleme.aylar.join(", ")} / {onizleme.yillar.join(", ")}
              </li>
              {onizleme.notlar.map((n) => (
                <li key={n} className="text-amber-700 dark:text-amber-400 text-xs">
                  {n}
                </li>
              ))}
            </ul>

            {/* Eşleşmeyen şubeler ayrı ve GÖRÜNÜR: sessizce atlanan satır,
                toplamı fark ettirmeden eksiltir. Kullanıcı önce şubeyi
                tanımlayıp dosyayı yeniden yüklemeli. */}
            {onizleme.eslesmeyen.length > 0 && (
              <div className="mt-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-2.5">
                <div className="text-sm font-medium text-red-800 dark:text-red-300">
                  {onizleme.eslesmeyen.length} şube sistemde bulunamadı — bu satırlar
                  YAZILMAYACAK
                </div>
                <div className="text-xs text-red-700 dark:text-red-400 mt-1 break-words">
                  {onizleme.eslesmeyen.join(", ")}
                </div>
                <div className="text-xs text-red-700 dark:text-red-400 mt-1">
                  Bunlar muhtemelen yeni açılan şubeler. Önce <b>Şube Yönetimi</b>&apos;nden
                  ekleyip dosyayı tekrar yükleyin, yoksa satışları toplama girmez.
                </div>
              </div>
            )}

            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
              Aynı şube-ay için kayıt varsa üzerine yazılır; <b>diğer aylara ve
              şubelere dokunulmaz</b>. Yine de öncesinde JSON yedek almanız önerilir.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={aktarimiOnayla}
                disabled={bekliyor}
                className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {bekliyor ? "Aktarılıyor…" : "Aktarımı Onayla"}
              </button>
              <button
                type="button"
                onClick={() => setOnizleme(null)}
                className={dugmeSinif}
                disabled={bekliyor}
              >
                Vazgeç
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dönem silme */}
      {yonetimMi && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <h3 className="font-medium text-sm mb-1">Bir dönemin satışlarını sil</h3>
          <p className="text-xs text-neutral-500 mb-3">
            Yanlış dosya yüklediyseniz o dönemi temizleyip doğrusunu yükleyebilirsiniz.
            Silme <b>yalnızca seçtiğiniz yıl ve ay</b> ile sınırlıdır; diğer ayların ve
            yılların verisine dokunulmaz. Ay tanımı da silinmez, sadece kg kayıtları.
          </p>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Yıl</span>
              <select
                value={silYil}
                onChange={(e) => setSilYil(Number(e.target.value))}
                className={gir}
              >
                {silYillari.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-neutral-500 mb-1">Ay</span>
              <select value={silAy} onChange={(e) => setSilAy(e.target.value)} className={gir}>
                {AYLAR_12.map((a) => (
                  <option key={a} value={a}>
                    {a.charAt(0) + a.slice(1).toLocaleLowerCase("tr")}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-sm text-neutral-600 dark:text-neutral-400 pb-2">
              {silinecekSayi > 0 ? (
                <>
                  <b>{silinecekSayi}</b> şube kaydı ·{" "}
                  <b>{silinecekKg.toLocaleString("tr-TR")} kg</b>
                </>
              ) : (
                "bu dönemde kayıt yok"
              )}
            </span>
            <button
              type="button"
              onClick={donemiSil}
              disabled={bekliyor || silinecekSayi === 0}
              className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {bekliyor ? "Siliniyor…" : "Bu dönemi sil"}
            </button>
          </div>

          {silmeSonuc && (
            <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 text-sm">
              {silmeSonuc}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
