"use client";

import { useMemo } from "react";
import { puanRenk } from "@/lib/skor";

/** Denetim + hızlı skor kayıtlarının ortak gösterim biçimi. */
export interface GecmisKayit {
  id: string;
  subeId: string;
  tarih: string;
  puan: number | null;
  /** Denetimde "Periyodik" vb., skorda "Gizli Müşteri" vb. */
  tur: string;
  kaynak: "denetim" | "skor";
  kisi: string;
}

const KAYNAK_ETIKET: Record<GecmisKayit["kaynak"], string> = {
  denetim: "📋 Denetim",
  skor: "⚡ Hızlı skor",
};

/**
 * Seçili şubenin önceki puanlarını, yeni kayıt girilirken formun içinde gösterir.
 * Denetim ve hızlı skor kayıtları tek listede birleştirilir; hiçbir kayıt
 * üzerine yazılmadığı için liste zamanla uzar.
 */
export function SubeGecmisPaneli({
  kayitlar,
  subeId,
  limit = 6,
}: {
  kayitlar: GecmisKayit[];
  subeId: string;
  limit?: number;
}) {
  const subeKayitlari = useMemo(
    () =>
      kayitlar
        .filter((k) => k.subeId === subeId)
        // Aynı gün birden fazla kayıt olabilir; eşitlikte yeni eklenen üstte kalsın.
        .sort((a, b) => (a.tarih === b.tarih ? 0 : a.tarih < b.tarih ? 1 : -1)),
    [kayitlar, subeId],
  );

  if (!subeId) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 px-4 py-3 text-xs text-neutral-500">
        Şube seçtiğinizde o şubenin önceki denetim ve skor puanları burada listelenir.
      </div>
    );
  }

  if (!subeKayitlari.length) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-4 py-3 text-xs text-neutral-500">
        Bu şube için önceki kayıt yok — bu ilk kayıt olacak.
      </div>
    );
  }

  const puanli = subeKayitlari.filter((k) => k.puan != null);
  const son = puanli[0];
  const ortalama = puanli.length
    ? Math.round((puanli.reduce((t, k) => t + (k.puan ?? 0), 0) / puanli.length) * 10) / 10
    : null;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs font-semibold mr-auto">
          Bu şubenin geçmişi · {subeKayitlari.length} kayıt
        </span>
        {son?.puan != null && (
          <span className="text-xs text-neutral-500">
            Son puan:{" "}
            <b style={{ color: puanRenk(son.puan) }}>{son.puan}</b>
            <span className="text-neutral-400">/100 · {son.tarih}</span>
          </span>
        )}
        {ortalama != null && (
          <span className="text-xs text-neutral-500">
            Ortalama: <b style={{ color: puanRenk(ortalama) }}>{ortalama}</b>
            <span className="text-neutral-400">/100</span>
          </span>
        )}
      </div>

      <ul>
        {subeKayitlari.slice(0, limit).map((k, i) => {
          // Bir sonraki (daha eski) puanlı kayda göre değişim.
          const oncekiPuan = subeKayitlari.slice(i + 1).find((x) => x.puan != null)?.puan ?? null;
          const fark = k.puan != null && oncekiPuan != null ? Math.round((k.puan - oncekiPuan) * 10) / 10 : null;
          return (
            <li
              key={k.id}
              className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]"
            >
              <span className="text-neutral-500 tabular-nums w-24">{k.tarih}</span>
              <span className="text-neutral-500 text-xs w-28">{KAYNAK_ETIKET[k.kaynak]}</span>
              <span className="text-neutral-600 dark:text-neutral-400 text-xs flex-1 min-w-32">
                {k.tur || "—"}
                {k.kisi ? ` · ${k.kisi}` : ""}
              </span>
              {fark != null && fark !== 0 && (
                <span
                  className="text-xs tabular-nums"
                  style={{ color: fark > 0 ? "#16a34a" : "#ef4444" }}
                >
                  {fark > 0 ? "▲" : "▼"} {Math.abs(fark)}
                </span>
              )}
              <span className="tabular-nums">
                <b style={{ color: puanRenk(k.puan ?? 0) }}>{k.puan ?? "—"}</b>
                <span className="text-neutral-400 text-xs">/100</span>
              </span>
            </li>
          );
        })}
      </ul>

      {subeKayitlari.length > limit && (
        <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500">
          + {subeKayitlari.length - limit} eski kayıt daha (tam liste için Denetim Geçmişi / Skor
          Geçmişi sekmesi)
        </div>
      )}
    </div>
  );
}
