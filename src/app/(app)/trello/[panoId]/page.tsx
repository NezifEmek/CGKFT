import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { panoDetay, etiketRengi, TrelloHatasi, type TrelloKart } from "@/lib/trello";

function tarihFmt(s: string | null): string {
  if (!s) return "";
  return new Date(s).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function gecmisMi(due: string | null, tamam: boolean): boolean {
  return Boolean(due) && !tamam && new Date(due!).getTime() < Date.now();
}

function Kart({ k, uyeAdi }: { k: TrelloKart; uyeAdi: Map<string, string> }) {
  const kontrolToplam = k.badges?.checkItems ?? 0;
  const kontrolBiten = k.badges?.checkItemsChecked ?? 0;

  return (
    <a
      href={k.shortUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
    >
      {k.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {k.labels.map((e) => (
            <span
              key={e.id}
              title={e.name || undefined}
              className="h-1.5 w-8 rounded-full"
              style={{ backgroundColor: etiketRengi(e.color) }}
            />
          ))}
        </div>
      )}

      {/* Kart metni Trello'dan gelen kullanıcı içeriği — düz metin olarak basılır. */}
      <div className="text-[13px] leading-snug">{k.name}</div>

      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-neutral-400">
        {k.due && (
          <span
            className={
              gecmisMi(k.due, k.dueComplete)
                ? "px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-medium"
                : k.dueComplete
                  ? "px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                  : ""
            }
          >
            🕑 {tarihFmt(k.due)}
          </span>
        )}
        {k.desc?.trim() && <span title="Açıklaması var">☰</span>}
        {(k.badges?.comments ?? 0) > 0 && <span>💬 {k.badges!.comments}</span>}
        {(k.badges?.attachments ?? 0) > 0 && <span>📎 {k.badges!.attachments}</span>}
        {kontrolToplam > 0 && (
          <span>
            ☑ {kontrolBiten}/{kontrolToplam}
          </span>
        )}
        {k.idMembers.map((id) => (
          <span
            key={id}
            title={uyeAdi.get(id) ?? undefined}
            className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-[9px] font-bold text-neutral-700 dark:text-neutral-200"
          >
            {(uyeAdi.get(id) ?? "?")
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </span>
        ))}
      </div>
    </a>
  );
}

export default async function TrelloPanoSayfasi({
  params,
}: {
  params: Promise<{ panoId: string }>;
}) {
  await requireProfile();
  const { panoId } = await params;

  let pano: Awaited<ReturnType<typeof panoDetay>>;
  try {
    pano = await panoDetay(panoId);
  } catch (e) {
    return (
      <div className="space-y-4">
        <Link href="/trello" className="text-sm text-neutral-500 hover:underline">
          ← Trello
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-sm text-red-800 dark:text-red-300">
          {e instanceof TrelloHatasi ? e.message : "Pano alınamadı."}
        </div>
      </div>
    );
  }

  const uyeAdi = new Map(pano.uyeler.map((u) => [u.id, u.fullName]));
  const listeKartlari = new Map<string, TrelloKart[]>();
  for (const k of pano.kartlar) {
    if (!listeKartlari.has(k.idList)) listeKartlari.set(k.idList, []);
    listeKartlari.get(k.idList)!.push(k);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/trello" className="text-sm text-neutral-500 hover:underline">
          ← Trello
        </Link>
        <div className="flex flex-wrap items-baseline gap-3 mt-2">
          <h1 className="text-xl font-semibold">{pano.name}</h1>
          <a
            href={pano.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-500 hover:underline"
          >
            Trello&apos;da aç ↗
          </a>
        </div>
        <p className="text-sm text-neutral-500 mt-1">
          {pano.listeler.length} liste · {pano.kartlar.length} kart
        </p>
        {pano.desc?.trim() && (
          <p className="text-xs text-neutral-500 mt-2 max-w-3xl leading-relaxed whitespace-pre-line">
            {pano.desc}
          </p>
        )}
      </div>

      {/* Listeler Trello'daki gibi yatay sütunlar; taşma sadece bu kapta. */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 items-start min-w-max">
          {pano.listeler.map((l) => {
            const kartlar = listeKartlari.get(l.id) ?? [];
            return (
              <div
                key={l.id}
                className="w-72 shrink-0 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 p-2"
              >
                <div className="flex items-baseline justify-between gap-2 px-1.5 py-1.5">
                  <h2 className="text-[13px] font-semibold leading-tight">{l.name}</h2>
                  <span className="text-[11px] text-neutral-500 shrink-0">{kartlar.length}</span>
                </div>
                <div className="space-y-1.5">
                  {kartlar.map((k) => (
                    <Kart key={k.id} k={k} uyeAdi={uyeAdi} />
                  ))}
                  {!kartlar.length && (
                    <div className="px-1.5 py-3 text-[11px] text-neutral-400">Kart yok</div>
                  )}
                </div>
              </div>
            );
          })}
          {!pano.listeler.length && (
            <div className="text-sm text-neutral-500">Bu panoda açık liste yok.</div>
          )}
        </div>
      </div>
    </div>
  );
}
