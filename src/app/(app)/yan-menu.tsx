"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";

export interface MenuOgesi {
  href: string;
  etiket: string;
  bolum: string;
}

export interface MenuBolumu {
  ad: string;
  simge: string;
  acikVarsayilan: boolean;
}

const ANAHTAR = "panel-menu-acik";

/**
 * Koyu yan menü — bölümler açılır kapanır.
 *
 * Menü 27 satıra çıkınca düz liste okunamaz hâle gelmişti. Artık konu
 * başlıklarına ayrıldı ve hangi başlıkların açık olduğu tarayıcıda
 * saklanıyor; kullanıcı her sayfa değişiminde menüyü yeniden açmıyor.
 *
 * Aktif sayfanın bölümü her hâlükârda açık gelir — kullanıcı bulunduğu
 * yeri göremezse menü işe yaramaz.
 */
export function YanMenuLinkleri({
  ogeler,
  bolumler,
}: {
  ogeler: MenuOgesi[];
  bolumler: MenuBolumu[];
}) {
  const yol = usePathname();

  // Hangi bölümde olduğumuz — aktif satırın bölümü.
  const aktifBolum = useMemo(() => {
    const eslesen = ogeler
      .filter((m) => (m.href === "/" ? yol === "/" : yol.startsWith(m.href)))
      .sort((a, b) => b.href.length - a.href.length)[0];
    return eslesen?.bolum ?? null;
  }, [ogeler, yol]);

  // Kaydedilmiş tercih. localStorage yalnızca tarayıcıda var; sunucuda null
  // dönerek hydration uyumsuzluğu önleniyor.
  //
  // useSyncExternalStore kullanılıyor, useEffect DEĞİL: etkinin içinden
  // eşzamanlı setState çağırmak zincirleme render tetikliyor ve React bunu
  // hata sayıyor. Değer render sırasında okunuyor, hiçbir durum yazılmıyor.
  const kayitliHam = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(ANAHTAR);
      } catch {
        return null;
      }
    },
    () => null,
  );

  // Kullanıcı bu oturumda bir şey açıp kapattıysa onun seçimi geçerli;
  // yoksa kaydedilmiş tercih, o da yoksa varsayılan.
  const [elleSecim, setElleSecim] = useState<Set<string> | null>(null);

  const acik = useMemo(() => {
    if (elleSecim) return elleSecim;
    if (kayitliHam) {
      try {
        const liste = JSON.parse(kayitliHam) as unknown;
        if (Array.isArray(liste)) return new Set(liste.filter((x): x is string => typeof x === "string"));
      } catch {
        // Bozuk kayıt varsayılana düşsün.
      }
    }
    return new Set(bolumler.filter((b) => b.acikVarsayilan).map((b) => b.ad));
  }, [elleSecim, kayitliHam, bolumler]);

  function degistir(ad: string) {
    const yeni = new Set(acik);
    if (yeni.has(ad)) yeni.delete(ad);
    else yeni.add(ad);
    setElleSecim(yeni);
    try {
      window.localStorage.setItem(ANAHTAR, JSON.stringify([...yeni]));
    } catch {
      // Yazılamazsa tercih kalıcı olmaz; menü yine çalışır.
    }
  }

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
      {bolumler.map((b) => {
        const bolumOgeleri = ogeler.filter((m) => m.bolum === b.ad);
        if (!bolumOgeleri.length) return null;

        const bolumAcik = acik.has(b.ad) || aktifBolum === b.ad;

        return (
          <div key={b.ad}>
            <button
              type="button"
              onClick={() => degistir(b.ad)}
              // Telefonda daha yüksek: parmakla basılacak. Masaüstünde
              // eski derli toplu haliyle kalıyor.
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 md:py-1.5 text-[11px] uppercase tracking-wide hover:bg-white/5"
              style={{ color: "#8b93a5" }}
            >
              <span>{b.simge}</span>
              <span className="flex-1 text-left">{b.ad}</span>
              <span className="text-[9px]">{bolumAcik ? "▾" : "▸"}</span>
              {!bolumAcik && (
                <span className="text-[10px] tabular-nums">{bolumOgeleri.length}</span>
              )}
            </button>

            {bolumAcik && (
              <div className="space-y-0.5 mt-0.5 mb-1.5">
                {bolumOgeleri.map((m) => {
                  const aktif = m.href === "/" ? yol === "/" : yol.startsWith(m.href);
                  return (
                    <Link
                      key={m.href}
                      href={m.href}
                      className="block rounded-lg pl-6 pr-3 py-3 md:py-1.5 text-[13px] transition-colors"
                      style={
                        aktif
                          ? { background: "#c0392b", color: "#fff", fontWeight: 600 }
                          : { color: "#c7ccd6" }
                      }
                    >
                      {m.etiket}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
