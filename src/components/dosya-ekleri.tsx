"use client";

import { useActionState, useEffect, useState } from "react";
import {
  dosyaYukle, dosyaSil, dosyaBaglantisi, dosyaBaglantilari,
} from "@/app/(app)/dosya-actions";
import { boyutYaz, simge, gorselMi, AZAMI_BOYUT, type Dosya } from "@/lib/dosya";

const btnSade = "yazdirma-gizle " +
  "rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm disabled:opacity-60";

/**
 * Bir kayda dosya ekleme/listeleme. Şikayet, sözleşme, şube… hepsi
 * aynı bileşeni kullanır; kapsam + kayıt kimliğiyle ayrışır.
 */
export function DosyaEkleri({
  kapsam,
  kayitId,
  dosyalar,
  duzenlenebilir = true,
  baslik = "Ekler",
}: {
  kapsam: string;
  kayitId: string;
  dosyalar: Dosya[];
  duzenlenebilir?: boolean;
  baslik?: string;
}) {
  const [d1, a1, p1] = useActionState(dosyaYukle, null);
  const [d2, a2, p2] = useActionState(dosyaSil, null);
  const [aciliyor, setAciliyor] = useState<string | null>(null);
  const [acmaHatasi, setAcmaHatasi] = useState<string | null>(null);
  const durum = d1 ?? d2;

  // ── Görsel önizlemeleri ────────────────────────────────────────────
  // Kova özel; her küçük resim için imzalı bağlantı gerekiyor. Tek
  // çağrıda toplu alınıyor, yoksa on ek = on gidiş-dönüş olurdu.
  // Bağlantılar 5 dakikada doluyor; sayfa açık kalırsa resimler kırılır,
  // bu yüzden süre dolmadan bir kez yenileniyor.
  const gorseller = dosyalar.filter((d) => gorselMi(d.ad, d.mime));
  const gorselAnahtari = gorseller.map((g) => g.id).join(",");
  const [onizleme, setOnizleme] = useState<Record<string, string>>({});

  useEffect(() => {
    // Görsel yoksa hiçbir şey yapılmıyor. Eski bağlantıları temizlemeye de
    // gerek yok: onizleme yalnızca listedeki görseller için okunuyor,
    // artık olmayan kaydın bağlantısı ekrana hiç girmiyor.
    if (!gorselAnahtari) return;

    let gecerli = true;
    const idler = gorselAnahtari.split(",");

    async function getir() {
      const sonuc = await dosyaBaglantilari(idler);
      if (gecerli && sonuc.url) setOnizleme(sonuc.url);
    }
    getir();
    // Bağlantı 300 sn geçerli — 4 dakikada bir tazeleniyor.
    const zamanlayici = setInterval(getir, 240_000);
    return () => {
      gecerli = false;
      clearInterval(zamanlayici);
    };
  }, [gorselAnahtari]);

  async function ac(id: string) {
    setAciliyor(id);
    setAcmaHatasi(null);
    const sonuc = await dosyaBaglantisi(id);
    setAciliyor(null);
    if (sonuc.hata || !sonuc.url) {
      setAcmaHatasi(sonuc.hata ?? "Bağlantı alınamadı.");
      return;
    }
    window.open(sonuc.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
        {baslik}
        {dosyalar.length > 0 && <span className="ml-1 text-neutral-400">({dosyalar.length})</span>}
      </h4>

      {/* Görsel şeridi — dosya adına tıklamadan içeriği görünsün.
          Şikayet eklerinin çoğu fotoğraf; ad listesi hiçbir şey anlatmıyordu. */}
      {gorseller.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {gorseller.map((g) => {
            const url = onizleme[g.id];
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => ac(g.id)}
                title={`${g.ad} — büyütmek için tıklayın`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-500"
              >
                {url ? (
                  // next/image kullanılmıyor: kaynak imzalı ve kısa ömürlü,
                  // eniyileyiciye verilmesi anlamsız.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={g.ad}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl">
                    🖼️
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {dosyalar.length > 0 && (
        <ul className="space-y-1 mb-2">
          {dosyalar.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-100 dark:border-neutral-800 px-2.5 py-1.5 text-sm"
            >
              <span>{simge(d.ad, d.mime)}</span>
              <button
                type="button"
                onClick={() => ac(d.id)}
                disabled={aciliyor === d.id}
                className="hover:underline text-left min-w-0 truncate flex-1 disabled:opacity-60"
              >
                {aciliyor === d.id ? "açılıyor…" : d.ad}
              </button>
              <span className="text-[11px] text-neutral-400 shrink-0">{boyutYaz(d.boyut)}</span>
              <span className="text-[11px] text-neutral-400 shrink-0">
                {d.created_at.slice(8, 10)}.{d.created_at.slice(5, 7)}.{d.created_at.slice(0, 4)}
              </span>
              {duzenlenebilir && (
                <form action={a2}>
                  <input type="hidden" name="dosya_id" value={d.id} />
                  <button type="submit" disabled={p2} className="text-xs text-red-500 hover:underline">
                    sil
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {duzenlenebilir && (
        <form action={a1} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="kapsam" value={kapsam} />
          <input type="hidden" name="kayit_id" value={kayitId} />
          <input
            type="file"
            name="dosya"
            required
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
            className="text-sm max-w-full"
          />
          <button type="submit" disabled={p1} className={btnSade}>
            {p1 ? "Yükleniyor…" : "Yükle"}
          </button>
        </form>
      )}

      {!dosyalar.length && !duzenlenebilir && (
        <p className="text-sm text-neutral-400">Ek yok.</p>
      )}

      {duzenlenebilir && (
        <p className="text-[11px] text-neutral-400 mt-1">
          PDF, resim, Word, Excel ve metin dosyaları · dosya başına en fazla{" "}
          {AZAMI_BOYUT / 1048576} MB. <b>Birden fazla dosya seçebilirsiniz.</b> Dosyalar
          özel alanda tutulur, bağlantıları 5 dakika geçerlidir.
        </p>
      )}

      {durum?.ok && <p className="text-sm text-emerald-600 mt-1">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600 mt-1">{durum.hata}</p>}
      {acmaHatasi && <p className="text-sm text-red-600 mt-1">{acmaHatasi}</p>}
    </div>
  );
}
