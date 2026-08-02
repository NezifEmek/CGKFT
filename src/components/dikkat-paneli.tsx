import Link from "next/link";

/**
 * "Bugün neye bakmam lazım?" paneli.
 *
 * Modüller çoğaldıkça her biri kendi ekranında bekliyor; kimse hepsini tek
 * tek dolaşmıyor. Bu panel yalnızca AKSİYON GEREKTİRENLERİ toplar —
 * süresi geçen, kimseye atanmamış, unutulmuş kayıtlar.
 *
 * Kural: temiz durumda panel HİÇ görünmez. Her gün "0 uyarı" gösteren bir
 * kutu, bir süre sonra bakılmayan bir kutuya dönüşür.
 */

export interface DikkatSatiri {
  /** Kaç kayıt */
  adet: number;
  etiket: string;
  href: string;
  /** true: kırmızı (gecikmiş), false: sarı (yaklaşan) */
  acil: boolean;
  aciklama?: string;
}

export function DikkatPaneli({ satirlar }: { satirlar: DikkatSatiri[] }) {
  const dolu = satirlar.filter((s) => s.adet > 0);
  if (!dolu.length) return null;

  const acilVar = dolu.some((s) => s.acil);

  return (
    <section
      className={`rounded-xl border p-4 ${
        acilVar
          ? "border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20"
          : "border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20"
      }`}
    >
      <h2 className="text-sm font-semibold mb-2.5">
        {acilVar ? "⚠️" : "🔔"} Dikkat gerektirenler
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {dolu.map((s) => (
          <Link
            key={s.etiket}
            href={s.href}
            className="flex items-center gap-3 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-2.5 hover:border-neutral-400 dark:hover:border-neutral-600"
          >
            <span
              className="text-xl font-extrabold tabular-nums"
              style={{ color: s.acil ? "#dc2626" : "#f59e0b" }}
            >
              {s.adet}
            </span>
            <span className="min-w-0">
              <span className="block text-sm leading-tight">{s.etiket}</span>
              {s.aciklama && (
                <span className="block text-[11px] text-neutral-500 leading-tight mt-0.5">
                  {s.aciklama}
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
