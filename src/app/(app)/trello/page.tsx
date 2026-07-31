import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import {
  calismaAlanlari,
  panolar,
  panolariSirala,
  oncelikliMi,
  trelloYapilandirildiMi,
  trelloTanila,
  TrelloHatasi,
  type TrelloPano,
} from "@/lib/trello";

function tarihFmt(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function TrelloSayfasi() {
  await requireProfile();

  if (!trelloYapilandirildiMi()) {
    const t = trelloTanila();
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Trello</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300 space-y-3">
          <p>
            <b>Trello bağlantısı kurulamadı.</b> Aşağıdaki tanı, hangi değişkenin eksik olduğunu
            gösteriyor — değerler gösterilmez.
          </p>

          <ul className="space-y-1 text-[13px]">
            <li>
              <code className="text-xs">TRELLO_API_KEY</code>:{" "}
              {t.anahtarVar ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  var · {t.anahtarIpucu}
                </span>
              ) : (
                <span className="text-red-700 dark:text-red-400 font-semibold">YOK</span>
              )}
            </li>
            <li>
              <code className="text-xs">TRELLO_TOKEN</code>:{" "}
              {t.tokenVar ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  var · {t.tokenUzunluk} karakter
                </span>
              ) : (
                <span className="text-red-700 dark:text-red-400 font-semibold">YOK</span>
              )}
            </li>
            <li>
              Ortamda &quot;TRELLO&quot; içeren değişken adları:{" "}
              {t.bulunanAdlar.length ? (
                <code className="text-xs">{t.bulunanAdlar.join(", ")}</code>
              ) : (
                <span className="text-red-700 dark:text-red-400">hiç yok</span>
              )}
            </li>
          </ul>

          <div className="text-[13px] space-y-1 pt-1 border-t border-amber-200 dark:border-amber-900">
            <p className="font-semibold">Nasıl düzeltilir</p>
            <p>
              Vercel → Settings → Environment Variables. Değişkenin <b>adı</b>{" "}
              <code className="text-xs">TRELLO_API_KEY</code>, <b>değeri</b> ise Trello&apos;dan
              aldığınız anahtar olmalı. Anahtar yanlışlıkla <b>ad</b> alanına yapıştırılmışsa
              yukarıdaki listede uzun bir karakter dizisi görünür — o satırı silip doğrusunu
              ekleyin.
            </p>
            <p>
              Değişkenleri ekledikten sonra <b>Deployments → ⋯ → Redeploy</b> yapmayı unutmayın;
              Vercel ortam değişkenlerini mevcut dağıtıma sonradan uygulamıyor.
            </p>
          </div>
        </div>
      </div>
    );
  }

  let alanlar: Awaited<ReturnType<typeof calismaAlanlari>> = [];
  let tumPanolar: TrelloPano[] = [];
  let hata: string | null = null;

  try {
    [alanlar, tumPanolar] = await Promise.all([calismaAlanlari(), panolar()]);
  } catch (e) {
    hata = e instanceof TrelloHatasi ? e.message : "Trello verisi alınamadı.";
  }

  if (hata) {
    const t = trelloTanila();
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Trello</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-sm text-red-800 dark:text-red-300 space-y-3">
          <p>{hata}</p>
          <ul className="text-[13px] space-y-1 pt-1 border-t border-red-200 dark:border-red-900">
            <li>
              <code className="text-xs">TRELLO_API_KEY</code>: {t.anahtarIpucu || "yok"}
            </li>
            <li>
              <code className="text-xs">TRELLO_TOKEN</code>: {t.tokenUzunluk} karakter, &quot;
              {t.tokenOnEk}…&quot; ile başlıyor
            </li>
            <li>
              {t.tokenBosluklu ? (
                <span className="font-semibold">
                  ⚠ Değerin başında veya sonunda boşluk/satır sonu var — kopyalama sırasında
                  fazladan karakter gelmiş.
                </span>
              ) : t.tokenOnEk.toUpperCase().startsWith("ATTA") ? (
                <>
                  Biçim yeni nesil Trello token&apos;ı (ATTA…) — uzunluk normal.{" "}
                  <b>
                    Sorun uzunlukta değil: bu token, TRELLO_API_KEY&apos;deki anahtar için
                    üretilmemiş.
                  </b>{" "}
                  Aşağıdaki bağlantı doğru anahtara bağlı token üretir.
                </>
              ) : t.tokenUzunluk === 64 ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  Uzunluk klasik biçimle uyumlu.
                </span>
              ) : (
                <>Biçim tanınmadı; token&apos;ın doğru anahtarla yeniden üretilmesi gerekiyor.</>
              )}
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // Panoları çalışma alanına göre grupla; alanı olmayanlar "Kişisel" altında.
  const alanAdi = new Map(alanlar.map((a) => [a.id, a.displayName]));
  const gruplar = new Map<string, TrelloPano[]>();
  for (const p of tumPanolar) {
    const anahtar = p.idOrganization ?? "_kisisel";
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar)!.push(p);
  }

  // Öncelikli pano içeren çalışma alanları önce görünsün.
  const siraliGruplar = [...gruplar].sort(([, a], [, b]) => {
    const oa = a.some((p) => oncelikliMi(p.name)) ? 0 : 1;
    const ob = b.some((p) => oncelikliMi(p.name)) ? 0 : 1;
    return oa - ob;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold mb-1">Trello</h1>
        <p className="text-sm text-neutral-500">
          {/* Açık panosu kalmayan çalışma alanları sayılmıyor: token birden
              fazla alana erişebiliyor ama panoları kapatılmışsa ekranda
              bölüm çıkmıyordu, sayı ile görünen uyuşmuyordu. */}
          {tumPanolar.length} pano · {gruplar.size} çalışma alanı · salt okunur, veriler 5
          dakikada bir yenilenir
        </p>
      </div>

      {siraliGruplar.map(([alanId, liste]) => (
        <section key={alanId}>
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 mb-2">
            {alanId === "_kisisel" ? "Çalışma alanı yok" : alanAdi.get(alanId) ?? "Bilinmeyen alan"}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {panolariSirala(liste).map((p) => {
              const onemli = oncelikliMi(p.name);
              return (
                <Link
                  key={p.id}
                  href={`/trello/${p.id}`}
                  className={`block rounded-xl border p-4 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60 ${
                    onemli
                      ? "border-red-300 dark:border-red-900 bg-white dark:bg-neutral-900"
                      : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-[15px] leading-tight">{p.name}</span>
                    {onemli && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-semibold">
                        takip
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400 mt-2">
                    Son hareket: {tarihFmt(p.dateLastActivity)}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {!tumPanolar.length && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6 text-center text-sm text-neutral-500">
          Bu token ile erişilebilen açık pano yok.
        </div>
      )}
    </div>
  );
}
