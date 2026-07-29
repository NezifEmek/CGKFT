"use client";

import { useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { satislariAktar, type AktarilacakSatir } from "./actions";
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

/** Türkçe karakterleri de doğru büyütüp boşlukları sadeleştirir. */
function normalize(s: string): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr");
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

interface Onizleme {
  satirlar: AktarilacakSatir[];
  eslesmeyen: string[];
  aylar: string[];
  yil: number;
  dosyaAdi: string;
}

export function AktarArayuz({
  subeler,
  satislar,
  aylar,
  varsayilanYil,
  yazabilir,
}: {
  subeler: AktarSube[];
  satislar: AktarSatis[];
  aylar: { yil: number; ay: string; gun_sayisi: number }[];
  varsayilanYil: number;
  yazabilir: boolean;
}) {
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

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
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Dosyada sayfa bulunamadı.");

      const satirlar = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (!satirlar.length) throw new Error("Sayfa boş görünüyor.");

      // Ay sütunlarını başlıklardan bul.
      const basliklar = Object.keys(satirlar[0]);
      const ayBasliklari = basliklar.filter((b) =>
        AYLAR_12.includes(normalize(b) as (typeof AYLAR_12)[number]),
      );
      if (!ayBasliklari.length) {
        throw new Error(
          "Ay sütunu bulunamadı. Başlık satırında OCAK, ŞUBAT… gibi ay adları olmalı.",
        );
      }

      // Şube eşleştirme: önce kod, sonra ad.
      const koda = new Map<string, AktarSube>();
      const ada = new Map<string, AktarSube>();
      for (const s of subeler) {
        if (s.kod) koda.set(normalize(s.kod), s);
        ada.set(normalize(s.ad), s);
      }

      const kodBaslik = basliklar.find((b) => normalize(b) === "KOD");
      const adBaslik = basliklar.find((b) => ["ŞUBE", "SUBE", "ŞUBE ADI", "AD"].includes(normalize(b)));
      if (!adBaslik && !kodBaslik) {
        throw new Error("Şube sütunu bulunamadı ('Kod' ya da 'Şube' başlığı gerekli).");
      }

      const cikti: AktarilacakSatir[] = [];
      const eslesmeyen = new Set<string>();

      for (const satir of satirlar) {
        const kod = kodBaslik ? normalize(String(satir[kodBaslik])) : "";
        const ad = adBaslik ? normalize(String(satir[adBaslik])) : "";
        const sube = (kod && koda.get(kod)) || (ad && ada.get(ad)) || null;

        if (!sube) {
          if (ad || kod) eslesmeyen.add(ad || kod);
          continue;
        }

        for (const basligi of ayBasliklari) {
          const ham = String(satir[basligi] ?? "").trim().replace(/\./g, "").replace(",", ".");
          if (ham === "") continue; // boş = veri yok, dokunma
          const kg = Number(ham);
          if (!Number.isFinite(kg) || kg < 0) continue;
          cikti.push({ subeId: sube.id, yil: varsayilanYil, ay: normalize(basligi), kg });
        }
      }

      if (!cikti.length) {
        throw new Error("Eşleşen şube / geçerli kg değeri bulunamadı.");
      }

      setOnizleme({
        satirlar: cikti,
        eslesmeyen: [...eslesmeyen].slice(0, 20),
        aylar: ayBasliklari.map(normalize),
        yil: varsayilanYil,
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
                <b>{onizleme.satirlar.length}</b> hücre {onizleme.yil} yılına yazılacak
              </li>
              <li>Aylar: {onizleme.aylar.join(", ")}</li>
              {onizleme.eslesmeyen.length > 0 && (
                <li className="text-red-700 dark:text-red-400">
                  Eşleşmeyen {onizleme.eslesmeyen.length} satır atlanacak:{" "}
                  {onizleme.eslesmeyen.join(", ")}
                </li>
              )}
            </ul>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
              Bu işlem mevcut kg değerlerinin üzerine yazar. Öncesinde JSON yedek almanız önerilir.
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
    </div>
  );
}
