"use client";

import { useActionState, useState } from "react";
import {
  subeIletisimKaydet,
  sorumluDegistir,
  sorumluGecmisEkle,
  sorumluGecmisGuncelle,
  sorumluGecmisSil,
} from "../actions";
import { haritaBaglantisi, telefonBicimle, telefonLinki } from "@/lib/konum";
import type { Sube, SubeSorumluGecmisi } from "@/types/database";

const gir =
  "w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const btn = "yazdirma-gizle " +
  "rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3.5 py-1.5 text-sm font-medium disabled:opacity-60";
const btnSade = "yazdirma-gizle " +
  "rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm disabled:opacity-60";

function Alan({ etiket, children }: { etiket: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{etiket}</span>
      {children}
    </label>
  );
}

function tarihYaz(t: string | null): string {
  if (!t) return "";
  const [y, a, g] = t.slice(0, 10).split("-");
  return g && a && y ? `${g}.${a}.${y}` : t;
}

// ─── İletişim ve konum ────────────────────────────────────────────────────

export function IletisimKarti({
  sube,
  duzenlenebilir,
}: {
  sube: Sube;
  duzenlenebilir: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [durum, action, pending] = useActionState(subeIletisimKaydet, null);

  const harita = haritaBaglantisi(sube);
  const bosMu = !sube.telefon && !sube.yetkili_telefon && !sube.eposta && !sube.adres && !sube.harita_url;

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">İletişim ve Konum</h2>
        {duzenlenebilir && (
          <button type="button" onClick={() => setAcik((v) => !v)} className="text-xs text-neutral-500 hover:underline">
            {acik ? "kapat" : bosMu ? "＋ bilgi gir" : "düzenle"}
          </button>
        )}
      </div>

      {!acik && (
        <div className="space-y-1.5 text-sm">
          {sube.telefon && (
            <div className="flex gap-2">
              <span className="text-neutral-500 w-28 shrink-0">Şube telefonu</span>
              <a href={`tel:${telefonLinki(sube.telefon)}`} className="hover:underline">
                {telefonBicimle(sube.telefon)}
              </a>
            </div>
          )}
          {sube.yetkili_telefon && (
            <div className="flex gap-2">
              <span className="text-neutral-500 w-28 shrink-0">Yetkili cep</span>
              <a href={`tel:${telefonLinki(sube.yetkili_telefon)}`} className="hover:underline">
                {telefonBicimle(sube.yetkili_telefon)}
              </a>
            </div>
          )}
          {sube.eposta && (
            <div className="flex gap-2">
              <span className="text-neutral-500 w-28 shrink-0">E-posta</span>
              <a href={`mailto:${sube.eposta}`} className="hover:underline break-all">
                {sube.eposta}
              </a>
            </div>
          )}
          {sube.adres && (
            <div className="flex gap-2">
              <span className="text-neutral-500 w-28 shrink-0">Adres</span>
              <span className="whitespace-pre-line">{sube.adres}</span>
            </div>
          )}
          {sube.iletisim_notu && (
            <div className="flex gap-2">
              <span className="text-neutral-500 w-28 shrink-0">Not</span>
              <span className="whitespace-pre-line">{sube.iletisim_notu}</span>
            </div>
          )}

          {harita && (
            <a
              href={harita}
              target="_blank"
              rel="noopener noreferrer"
              className={btnSade + " inline-flex items-center gap-1.5 mt-2"}
            >
              📍 Haritada aç
              {sube.enlem == null && (
                <span className="text-[10px] text-neutral-400">(adresle arar)</span>
              )}
            </a>
          )}

          {bosMu && (
            <p className="text-sm text-neutral-400">
              Henüz iletişim bilgisi girilmemiş.
              {duzenlenebilir ? " “＋ bilgi gir”e basın." : ""}
            </p>
          )}
        </div>
      )}

      {acik && (
        <form action={action} className="space-y-3">
          <input type="hidden" name="sube_id" value={sube.id} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Alan etiket="Şube telefonu">
              <input name="telefon" defaultValue={sube.telefon ?? ""} placeholder="0262 000 00 00" className={gir} />
            </Alan>
            <Alan etiket="Şube yetkilisi cep">
              <input name="yetkili_telefon" defaultValue={sube.yetkili_telefon ?? ""} placeholder="0532 000 00 00" className={gir} />
            </Alan>
          </div>
          <Alan etiket="E-posta">
            <input name="eposta" type="email" defaultValue={sube.eposta ?? ""} className={gir} />
          </Alan>
          <Alan etiket="Adres">
            <textarea name="adres" rows={2} defaultValue={sube.adres ?? ""} className={gir} />
          </Alan>
          <Alan etiket="Google Maps bağlantısı">
            <input
              name="harita_url"
              defaultValue={sube.harita_url ?? ""}
              placeholder="https://maps.app.goo.gl/… veya https://www.google.com/maps/…"
              className={gir}
            />
          </Alan>
          <p className="text-[11px] text-neutral-400 -mt-1">
            Google Haritalar&apos;da şubeyi bulun → <b>Paylaş</b> → <b>Bağlantıyı kopyala</b> → buraya yapıştırın.
            Koordinat bağlantının içinden okunur, ayrıca girmenize gerek yok.
            {sube.enlem != null && (
              <> Kayıtlı koordinat: <span className="font-mono">{sube.enlem}, {sube.boylam}</span></>
            )}
          </p>
          <Alan etiket="Not">
            <input name="iletisim_notu" defaultValue={sube.iletisim_notu ?? ""} className={gir} />
          </Alan>

          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className={btn}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button type="button" onClick={() => setAcik(false)} className={btnSade}>
              Vazgeç
            </button>
          </div>
          {durum?.ok && <p className="text-sm text-emerald-600">✓ {durum.ok}</p>}
          {durum?.hata && <p className="text-sm text-red-600">{durum.hata}</p>}
        </form>
      )}
    </section>
  );
}

// ─── Sorumlu geçmişi ──────────────────────────────────────────────────────

const TARAF_BASLIK: Record<string, string> = {
  merkez: "Adıyaman Çiğköfte tarafı (merkez yetkilisi)",
  sube: "Şube tarafı (işletmeci)",
};

export function SorumluGecmisi({
  sube,
  kayitlar,
  duzenlenebilir,
  silebilir,
  tabloYok,
}: {
  sube: Sube;
  kayitlar: SubeSorumluGecmisi[];
  duzenlenebilir: boolean;
  silebilir: boolean;
  tabloYok: boolean;
}) {
  const [degistirTaraf, setDegistirTaraf] = useState<"merkez" | "sube" | null>(null);
  const [ekleTaraf, setEkleTaraf] = useState<"merkez" | "sube" | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);

  const [d1, a1, p1] = useActionState(sorumluDegistir, null);
  const [d2, a2, p2] = useActionState(sorumluGecmisEkle, null);
  const [d3, a3, p3] = useActionState(sorumluGecmisGuncelle, null);
  const [d4, a4, p4] = useActionState(sorumluGecmisSil, null);
  const durum = d1 ?? d2 ?? d3 ?? d4;

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
      <h2 className="text-sm font-semibold mb-1">Sorumlu Geçmişi</h2>
      <p className="text-xs text-neutral-500 mb-3">
        Hangi dönemde kimin görevli olduğu. Sorumlu değiştiğinde önceki dönem kendiliğinden kapanır.
      </p>

      {tabloYok && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-sm text-amber-800 dark:text-amber-300 mb-3">
          <b>Tablo henüz oluşturulmamış.</b> <code className="text-xs">0010_sube_ana_veri.sql</code> Supabase&apos;de
          çalıştırılmalı.
        </div>
      )}

      {durum?.ok && <p className="text-sm text-emerald-600 mb-2">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600 mb-2">{durum.hata}</p>}

      <div className="space-y-4">
        {(["merkez", "sube"] as const).map((taraf) => {
          const liste = kayitlar
            .filter((k) => k.taraf === taraf)
            .sort((a, b) => {
              // Görevdeki (bitis null) en üstte, sonra en yeni dönem.
              if (!a.bitis && b.bitis) return -1;
              if (a.bitis && !b.bitis) return 1;
              return (b.baslangic ?? "").localeCompare(a.baslangic ?? "");
            });
          const guncel = taraf === "merkez" ? sube.merkez_yetkilisi : sube.sube_yetkilisi;

          return (
            <div key={taraf}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  {TARAF_BASLIK[taraf]}
                </h3>
                {duzenlenebilir && !tabloYok && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setDegistirTaraf(degistirTaraf === taraf ? null : taraf); setEkleTaraf(null); }}
                      className="text-xs text-neutral-500 hover:underline"
                    >
                      sorumluyu değiştir
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEkleTaraf(ekleTaraf === taraf ? null : taraf); setDegistirTaraf(null); }}
                      className="text-xs text-neutral-500 hover:underline"
                    >
                      geçmiş ekle
                    </button>
                  </div>
                )}
              </div>

              {degistirTaraf === taraf && (
                <form action={a1} className="flex flex-wrap items-end gap-2 mb-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 p-3">
                  <input type="hidden" name="sube_id" value={sube.id} />
                  <input type="hidden" name="taraf" value={taraf} />
                  <div className="flex-1 min-w-40">
                    <span className="block text-xs text-neutral-500 mb-1">Yeni sorumlu</span>
                    <input name="kisi_adi" required defaultValue="" className={gir} />
                  </div>
                  <button type="submit" disabled={p1} className={btn}>Değiştir</button>
                  <p className="w-full text-[11px] text-neutral-500">
                    {guncel ? <>Şu anki: <b>{guncel}</b>. </> : null}
                    Kaydedince bugün itibarıyla eski dönem kapanır, yenisi başlar.
                  </p>
                </form>
              )}

              {ekleTaraf === taraf && (
                <form action={a2} className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 p-3 mb-2 space-y-2">
                  <input type="hidden" name="sube_id" value={sube.id} />
                  <input type="hidden" name="taraf" value={taraf} />
                  <div className="grid sm:grid-cols-3 gap-2">
                    <Alan etiket="Kişi *">
                      <input name="kisi_adi" required className={gir} />
                    </Alan>
                    <Alan etiket="Başlangıç">
                      <input name="baslangic" type="date" className={gir} />
                    </Alan>
                    <Alan etiket="Bitiş *">
                      <input name="bitis" type="date" required className={gir} />
                    </Alan>
                  </div>
                  <Alan etiket="Açıklama">
                    <input name="aciklama" className={gir} />
                  </Alan>
                  <button type="submit" disabled={p2} className={btn}>Geçmiş kaydı ekle</button>
                  <p className="text-[11px] text-neutral-500">
                    Bu form <b>geçmiş</b> dönemler içindir. Bugün görevde olan kişi için “sorumluyu değiştir”i kullanın.
                  </p>
                </form>
              )}

              {liste.length ? (
                <ul className="space-y-1">
                  {liste.map((k) => (
                    <li
                      key={k.id}
                      className="rounded-lg border border-neutral-100 dark:border-neutral-800 px-3 py-2"
                    >
                      {duzenlenen === k.id ? (
                        <form action={a3} className="space-y-2">
                          <input type="hidden" name="kayit_id" value={k.id} />
                          <input type="hidden" name="sube_id" value={sube.id} />
                          <div className="grid sm:grid-cols-3 gap-2">
                            <Alan etiket="Kişi">
                              <input name="kisi_adi" defaultValue={k.kisi_adi} required className={gir} />
                            </Alan>
                            <Alan etiket="Başlangıç">
                              <input name="baslangic" type="date" defaultValue={k.baslangic ?? ""} className={gir} />
                            </Alan>
                            <Alan etiket="Bitiş (boş = görevde)">
                              <input name="bitis" type="date" defaultValue={k.bitis ?? ""} className={gir} />
                            </Alan>
                          </div>
                          <Alan etiket="Açıklama">
                            <input name="aciklama" defaultValue={k.aciklama} className={gir} />
                          </Alan>
                          <div className="flex items-center gap-2">
                            <button type="submit" disabled={p3} className={btn}>Kaydet</button>
                            <button type="button" onClick={() => setDuzenlenen(null)} className={btnSade}>
                              Vazgeç
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="font-medium text-sm">{k.kisi_adi}</span>
                          {!k.bitis && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                              görevde
                            </span>
                          )}
                          <span className="text-xs text-neutral-500">
                            {k.baslangic ? tarihYaz(k.baslangic) : "başlangıç bilinmiyor"} –{" "}
                            {k.bitis ? tarihYaz(k.bitis) : "bugün"}
                          </span>
                          {k.aciklama && (
                            <span className="text-xs text-neutral-400">· {k.aciklama}</span>
                          )}
                          {duzenlenebilir && (
                            <button
                              type="button"
                              onClick={() => setDuzenlenen(k.id)}
                              className="text-xs text-neutral-400 hover:underline ml-auto"
                            >
                              düzelt
                            </button>
                          )}
                          {silebilir && (
                            <form action={a4}>
                              <input type="hidden" name="kayit_id" value={k.id} />
                              <input type="hidden" name="sube_id" value={sube.id} />
                              <button type="submit" disabled={p4} className="text-xs text-red-500 hover:underline">
                                sil
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-400">
                  Kayıt yok{guncel ? ` — şu anki sorumlu: ${guncel}` : ""}.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
