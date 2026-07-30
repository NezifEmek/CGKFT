import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { pozisyonlariNormalize } from "@/lib/dokuman";
import {
  organizasyonKur,
  dugumSay,
  GRUP_ETIKET,
  GRUP_RENK,
  type OrgDugum,
  type OrgGrup,
} from "@/lib/organizasyon";

function Kutu({ d }: { d: OrgDugum }) {
  const renk = GRUP_RENK[d.grup];
  return (
    <div
      className="rounded-md px-3 py-2 text-white text-center shadow-sm min-w-44 max-w-56"
      style={{ backgroundColor: renk }}
    >
      <div className="text-[13px] font-bold leading-tight">{d.adSoyad || d.unvan}</div>
      {d.adSoyad && <div className="text-[11px] opacity-85 leading-tight mt-0.5">{d.unvan}</div>}
      {!d.pozisyonMu && (
        <div className="text-[10px] opacity-70 mt-0.5">görev tanımı kaydı yok</div>
      )}
    </div>
  );
}

/** Ağacı yukarıdan aşağı, bağlantı çizgileriyle çizer. */
function Dal({ d }: { d: OrgDugum }) {
  const cocukVar = d.cocuklar.length > 0;
  return (
    <li className="relative flex flex-col items-center px-2">
      {/* üst bağlantı */}
      <span className="absolute top-0 left-1/2 h-4 w-px bg-neutral-300 dark:bg-neutral-600 -translate-x-1/2 [li:first-child:last-child>&]:hidden" />
      <div className="pt-4">
        <Kutu d={d} />
      </div>
      {cocukVar && (
        <>
          <span className="h-4 w-px bg-neutral-300 dark:bg-neutral-600" />
          <ul className="flex items-start relative before:absolute before:top-0 before:left-[calc(50%/var(--n))] before:right-[calc(50%/var(--n))] before:h-px before:bg-neutral-300 dark:before:bg-neutral-600"
              style={{ ["--n" as string]: d.cocuklar.length }}>
            {d.cocuklar.map((c) => (
              <Dal key={c.id} d={c} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export default async function OrganizasyonSayfasi() {
  await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("dokuman_ayarlari")
    .select("pozisyonlar, updated_at")
    .eq("id", 1)
    .maybeSingle<{ pozisyonlar: unknown; updated_at: string }>();

  const pozisyonlar = pozisyonlariNormalize(data?.pozisyonlar);
  const { kokler, bagsizlar } = organizasyonKur(pozisyonlar);
  const toplam = kokler.reduce((t, k) => t + dugumSay(k), 0) + bagsizlar.length;

  const gruplar: OrgGrup[] = ["yonetim", "idari", "bolge", "uretim"];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Organizasyon Şeması</h1>
        <p className="text-sm text-neutral-500">
          {toplam} kutu · {pozisyonlar.length} görev tanımından otomatik türetilir
          {data?.updated_at ? ` · son güncelleme ${data.updated_at.slice(0, 10)}` : ""}
        </p>
      </div>

      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border-l-[3px] border-red-700 px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
        Bu şema elle güncellenmez. Kutular ve bağlantılar{" "}
        <Link href="/dokuman" className="underline font-medium">
          Doküman Yönetimi
        </Link>{" "}
        ekranındaki görev tanımlarından türetiliyor: bir pozisyonun{" "}
        <b>Bağlı Olduğu Kişi</b> alanı kimi gösteriyorsa şemada onun altına
        yerleşiyor. Birini eklemek, çıkarmak veya yerini değiştirmek için görev
        tanımını düzenlemeniz yeterli — şema aynı anda güncellenir.
      </div>

      {/* Renk açıklaması */}
      <div className="flex flex-wrap gap-4">
        {gruplar.map((g) => (
          <span key={g} className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: GRUP_RENK[g] }}
            />
            {GRUP_ETIKET[g]}
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 overflow-x-auto">
        {kokler.length ? (
          <ul className="flex justify-center items-start min-w-max">
            {kokler.map((k) => (
              <Dal key={k.id} d={k} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500 text-center py-8">
            Şema çizilemedi — görev tanımlarında &quot;Bağlı Olduğu Kişi&quot; bilgisi yok.
          </p>
        )}
      </div>

      {bagsizlar.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          <b>Şemaya bağlanamayan {bagsizlar.length} pozisyon:</b>{" "}
          {bagsizlar.map((b) => b.unvan).join(", ")}. Bu pozisyonların görev tanımında{" "}
          <b>Bağlı Olduğu Kişi</b> alanı boş.
        </div>
      )}
    </div>
  );
}
