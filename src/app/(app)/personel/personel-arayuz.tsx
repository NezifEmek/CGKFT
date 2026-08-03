"use client";

import { useActionState, useMemo, useState } from "react";
import { personelKaydet, personelSil, atamaEkle, atamaGuncelle, atamaSil } from "./actions";
import {
  PRIM_GRUPLARI, PRIM_GRUP_ETIKET, aktifMi, kadroUyarilari,
  type Personel, type Atama, type PozisyonKisa, type Uyari,
} from "@/lib/kadro";

const gir =
  "w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const kart =
  "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900";
const btn = "yazdirma-gizle " +
  "rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3.5 py-1.5 text-sm font-medium disabled:opacity-60";
const btnSade = "yazdirma-gizle " +
  "rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm disabled:opacity-60";

function A({ e, children }: { e: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-neutral-500 mb-1">{e}</span>
      {children}
    </label>
  );
}

function tarihYaz(t: string | null): string {
  if (!t) return "";
  const [y, a, g] = t.slice(0, 10).split("-");
  return g && a && y ? `${g}.${a}.${y}` : t;
}

export function PersonelArayuz({
  personeller, atamalar, pozisyonlar, profiller, bugun, duzenlenebilir, tabloYok,
}: {
  personeller: Personel[];
  atamalar: Atama[];
  pozisyonlar: PozisyonKisa[];
  profiller: { id: string; ad_soyad: string }[];
  bugun: string;
  duzenlenebilir: boolean;
  tabloYok: boolean;
}) {
  const [secili, setSecili] = useState<string | null>(null);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [ayrilanGoster, setAyrilanGoster] = useState(false);
  const [duzenlenenAtama, setDuzenlenenAtama] = useState<string | null>(null);

  const [d1, a1, p1] = useActionState(personelKaydet, null);
  const [d2, a2, p2] = useActionState(personelSil, null);
  const [d3, a3, p3] = useActionState(atamaEkle, null);
  const [d4, a4, p4] = useActionState(atamaGuncelle, null);
  const [d5, a5, p5] = useActionState(atamaSil, null);
  const durum = d1 ?? d2 ?? d3 ?? d4 ?? d5;

  const pozIle = useMemo(() => new Map(pozisyonlar.map((p) => [p.id, p])), [pozisyonlar]);

  const uyarilar = useMemo(
    () => kadroUyarilari(personeller, atamalar, pozisyonlar, bugun),
    [personeller, atamalar, pozisyonlar, bugun],
  );

  const listelenen = useMemo(() => {
    const l = ayrilanGoster ? personeller : personeller.filter((p) => aktifMi(p, bugun));
    return [...l].sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr"));
  }, [personeller, ayrilanGoster, bugun]);

  const ayrilanSayisi = personeller.filter((p) => !aktifMi(p, bugun)).length;
  const seciliKisi = personeller.find((p) => p.id === secili) ?? null;
  const seciliAtamalar = atamalar
    .filter((a) => a.personel_id === secili)
    .sort((x, y) => {
      if (!x.bitis && y.bitis) return -1;
      if (x.bitis && !y.bitis) return 1;
      return (y.baslangic ?? "").localeCompare(x.baslangic ?? "");
    });

  return (
    <div className="space-y-4">
      {tabloYok && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          <b>Kadro tabloları henüz oluşturulmamış.</b>{" "}
          <code className="text-xs">0018_kadro.sql</code> Supabase&apos;de çalıştırılmalı.
        </div>
      )}

      {durum?.ok && <p className="text-sm text-emerald-600">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600">{durum.hata}</p>}

      <UyariPaneli uyarilar={uyarilar} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-500">
          {listelenen.length} kişi
          {ayrilanSayisi > 0 && !ayrilanGoster ? ` · ${ayrilanSayisi} ayrılmış gizli` : ""}
        </span>
        {ayrilanSayisi > 0 && (
          <label className="flex items-center gap-1.5 text-sm text-neutral-500">
            <input
              type="checkbox"
              checked={ayrilanGoster}
              onChange={(e) => setAyrilanGoster(e.target.checked)}
            />
            Ayrılanları da göster
          </label>
        )}
        {duzenlenebilir && !tabloYok && (
          <button
            type="button"
            onClick={() => { setSecili(null); setEkleAcik((v) => !v); }}
            className={btn + " ml-auto"}
          >
            {ekleAcik ? "Vazgeç" : "＋ Personel ekle"}
          </button>
        )}
      </div>

      {ekleAcik && duzenlenebilir && (
        <KisiFormu
          action={a1}
          pending={p1}
          kisi={null}
          profiller={profiller}
          kapat={() => setEkleAcik(false)}
        />
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 items-start">
        {/* ── Kadro listesi ── */}
        <div className={kart + " overflow-hidden"}>
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-xs text-neutral-500">
              <tr>
                <th className="text-left font-medium px-3 py-2">Ad Soyad</th>
                <th className="text-left font-medium px-3 py-2">Görev</th>
                <th className="text-left font-medium px-3 py-2">Prim</th>
              </tr>
            </thead>
            <tbody>
              {listelenen.map((k) => {
                const acikAtamalar = atamalar.filter((a) => a.personel_id === k.id && !a.bitis);
                const gorevler = acikAtamalar
                  .map((a) => pozIle.get(a.pozisyon_id)?.unvan ?? "(tanımsız görev)")
                  .join(", ");
                const gruplar = [...new Set(acikAtamalar.map((a) => a.prim_grubu))]
                  .filter((g) => g !== "yok");
                const pasif = !aktifMi(k, bugun);
                return (
                  <tr
                    key={k.id}
                    onClick={() => { setSecili(k.id); setEkleAcik(false); setDuzenlenenAtama(null); }}
                    className={`border-t border-neutral-100 dark:border-neutral-800 cursor-pointer ${
                      secili === k.id
                        ? "bg-neutral-100 dark:bg-neutral-800"
                        : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span className={pasif ? "line-through text-neutral-400" : "font-medium"}>
                        {k.ad_soyad}
                      </span>
                      {pasif && (
                        <span className="block text-[10px] text-neutral-400">
                          ayrıldı · {tarihYaz(k.ayrilis)}
                        </span>
                      )}
                      {k.profil_id && (
                        <span className="ml-1.5 text-[10px] text-neutral-400">panel hesabı var</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                      {gorevler || <span className="text-amber-600">atanmamış</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500">
                      {gruplar.length
                        ? gruplar.map((g) => PRIM_GRUP_ETIKET[g as never] ?? g).join(", ")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {!listelenen.length && (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-neutral-400">
                    Kadroda kimse yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Seçili kişi ── */}
        {seciliKisi && (
          <div className="space-y-4">
            <KisiFormu
              key={seciliKisi.id}
              action={a1}
              pending={p1}
              kisi={seciliKisi}
              profiller={profiller}
              kapat={() => setSecili(null)}
              silAction={duzenlenebilir ? a2 : undefined}
              silPending={p2}
            />

            <section className={kart + " p-4"}>
              <h3 className="text-sm font-semibold mb-1">Görev geçmişi</h3>
              <p className="text-xs text-neutral-500 mb-3">
                Bitiş boşsa kişi hâlen o görevde. Prim, göreve başlanan aydan
                <b> sonraki</b> aydan itibaren işler.
              </p>

              {seciliAtamalar.length ? (
                <ul className="space-y-1.5 mb-3">
                  {seciliAtamalar.map((a) => {
                    const poz = pozIle.get(a.pozisyon_id);
                    return (
                      <li
                        key={a.id}
                        className="rounded-lg border border-neutral-100 dark:border-neutral-800 px-3 py-2"
                      >
                        {duzenlenenAtama === a.id && duzenlenebilir ? (
                          <form action={a4} className="space-y-2">
                            <input type="hidden" name="atama_id" value={a.id} />
                            <div className="grid sm:grid-cols-3 gap-2">
                              <A e="Başlangıç">
                                <input name="baslangic" type="date" defaultValue={a.baslangic ?? ""} className={gir} />
                              </A>
                              <A e="Bitiş (boş = görevde)">
                                <input name="bitis" type="date" defaultValue={a.bitis ?? ""} className={gir} />
                              </A>
                              <A e="Prim grubu">
                                <select name="prim_grubu" defaultValue={a.prim_grubu} className={gir}>
                                  {PRIM_GRUPLARI.map((g) => (
                                    <option key={g} value={g}>{PRIM_GRUP_ETIKET[g]}</option>
                                  ))}
                                </select>
                              </A>
                            </div>
                            <A e="Açıklama">
                              <input name="aciklama" defaultValue={a.aciklama} className={gir} />
                            </A>
                            <div className="flex gap-2">
                              <button type="submit" disabled={p4} className={btn}>Kaydet</button>
                              <button type="button" onClick={() => setDuzenlenenAtama(null)} className={btnSade}>
                                Vazgeç
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-medium text-sm">
                              {poz?.unvan ?? <span className="text-red-600">tanımsız görev</span>}
                            </span>
                            {!a.bitis && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                görevde
                              </span>
                            )}
                            <span className="text-xs text-neutral-500">
                              {a.baslangic ? tarihYaz(a.baslangic) : "başlangıç bilinmiyor"} –{" "}
                              {a.bitis ? tarihYaz(a.bitis) : "bugün"}
                            </span>
                            <span className="text-[11px] text-neutral-400">
                              {PRIM_GRUP_ETIKET[a.prim_grubu as never] ?? a.prim_grubu}
                            </span>
                            {a.aciklama && (
                              <span className="text-[11px] text-neutral-400">· {a.aciklama}</span>
                            )}
                            {duzenlenebilir && (
                              <span className="ml-auto flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDuzenlenenAtama(a.id)}
                                  className="text-xs text-neutral-500 hover:underline"
                                >
                                  düzelt
                                </button>
                                <form action={a5}>
                                  <input type="hidden" name="atama_id" value={a.id} />
                                  <button type="submit" disabled={p5} className="text-xs text-red-500 hover:underline">
                                    sil
                                  </button>
                                </form>
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-neutral-400 mb-3">Henüz görev atanmamış.</p>
              )}

              {duzenlenebilir && (
                <form action={a3} className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 p-3 space-y-2">
                  <input type="hidden" name="personel_id" value={seciliKisi.id} />
                  <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Yeni görev ata
                  </h4>
                  <A e="Görev tanımı *">
                    <select name="pozisyon_id" required defaultValue="" className={gir}>
                      <option value="" disabled>— görev seçin —</option>
                      {pozisyonlar.map((p) => {
                        // Bir göreve KAÇ KİŞİ atanmış olduğunu burada göstermek
                        // önemli: aynı görevde birden fazla kişi olabileceği
                        // belli olmayınca kullanıcı kişi başına ayrı görev
                        // tanımı açıyor ve organizasyon şeması aynı kutudan
                        // üç tane gösteriyor.
                        const kimler = atamalar
                          .filter((a) => a.pozisyon_id === p.id && !a.bitis)
                          .map((a) => personeller.find((x) => x.id === a.personel_id)?.ad_soyad)
                          .filter(Boolean);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.unvan}
                            {kimler.length ? ` — şu an: ${kimler.join(", ")}` : " — boş"}
                          </option>
                        );
                      })}
                    </select>
                  </A>
                  <p className="text-[11px] text-neutral-500 -mt-1">
                    Aynı göreve <b>birden fazla kişi</b> atanabilir — her kişi için ayrı görev
                    tanımı açmanız gerekmez. Örneğin üç şoför tek &quot;Sevkiyat Şoförü&quot;
                    tanımını paylaşır.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <A e="Başlangıç">
                      <input name="baslangic" type="date" className={gir} />
                    </A>
                    <A e="Bitiş (boş = görevde)">
                      <input name="bitis" type="date" className={gir} />
                    </A>
                    <A e="Prim grubu">
                      <select name="prim_grubu" defaultValue="yok" className={gir}>
                        {PRIM_GRUPLARI.map((g) => (
                          <option key={g} value={g}>{PRIM_GRUP_ETIKET[g]}</option>
                        ))}
                      </select>
                    </A>
                  </div>
                  <A e="Açıklama">
                    <input name="aciklama" className={gir} />
                  </A>
                  <button type="submit" disabled={p3} className={btn}>Görevi ata</button>
                </form>
              )}
            </section>
          </div>
        )}

        {!seciliKisi && !ekleAcik && (
          <div className={kart + " p-8 text-center text-sm text-neutral-400"}>
            Görev geçmişini görmek ve düzenlemek için soldan bir kişi seçin.
          </div>
        )}
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function KisiFormu({
  action, pending, kisi, profiller, kapat, silAction, silPending,
}: {
  action: any;
  pending: boolean;
  kisi: Personel | null;
  profiller: { id: string; ad_soyad: string }[];
  kapat: () => void;
  silAction?: any;
  silPending?: boolean;
}) {
  return (
    <section className={kart + " p-4 space-y-3"}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{kisi ? kisi.ad_soyad : "Yeni personel"}</h3>
        <button type="button" onClick={kapat} className="text-xs text-neutral-500 hover:underline">
          kapat
        </button>
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="personel_id" value={kisi?.id ?? ""} />
        <A e="Ad Soyad *">
          <input name="ad_soyad" required defaultValue={kisi?.ad_soyad ?? ""} className={gir} />
        </A>
        <div className="grid sm:grid-cols-2 gap-2">
          <A e="Telefon"><input name="telefon" defaultValue={kisi?.telefon ?? ""} className={gir} /></A>
          <A e="E-posta"><input name="eposta" type="email" defaultValue={kisi?.eposta ?? ""} className={gir} /></A>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <A e="İşe giriş">
            <input name="ise_giris" type="date" defaultValue={kisi?.ise_giris ?? ""} className={gir} />
          </A>
          <A e="Ayrılış">
            <input name="ayrilis" type="date" defaultValue={kisi?.ayrilis ?? ""} className={gir} />
          </A>
        </div>
        <p className="text-[11px] text-neutral-500 -mt-1">
          Ayrılış tarihi girilince açık görevler o tarihte kendiliğinden kapanır ve kişi
          sonraki ayların priminden düşer. <b>Geçmiş aylar değişmez.</b>
        </p>
        <A e="Panel hesabı">
          <select name="profil_id" defaultValue={kisi?.profil_id ?? ""} className={gir}>
            <option value="">— yok (girişi olmayan personel) —</option>
            {profiller.map((p) => (
              <option key={p.id} value={p.id}>{p.ad_soyad}</option>
            ))}
          </select>
        </A>
        <A e="Notlar"><input name="notlar" defaultValue={kisi?.notlar ?? ""} className={gir} /></A>
        <button type="submit" disabled={pending} className={btn}>
          {kisi ? "Güncelle" : "Personeli ekle"}
        </button>
      </form>

      {kisi && silAction && (
        <form action={silAction} className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <input type="hidden" name="personel_id" value={kisi.id} />
          <button type="submit" disabled={silPending} className="text-xs text-red-600 hover:underline">
            🗑 Kadrodan sil
          </button>
          <p className="text-[11px] text-neutral-400 mt-1">
            Ayrılan biri için silmek yerine <b>ayrılış tarihi</b> girin — geçmiş prim ve
            denetim kayıtları kişiye bağlı kalsın.
          </p>
        </form>
      )}
    </section>
  );
}

function UyariPaneli({ uyarilar }: { uyarilar: Uyari[] }) {
  const [acik, setAcik] = useState(true);
  if (!uyarilar.length) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
        ✓ Kadroda düzeltilmesi gereken bir şey yok.
      </div>
    );
  }
  const agir = uyarilar.filter((u) => u.agir).length;

  return (
    <section
      className={`rounded-xl border p-4 ${
        agir
          ? "border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20"
          : "border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20"
      }`}
    >
      <button
        type="button"
        onClick={() => setAcik((v) => !v)}
        className="w-full flex items-center gap-2 text-sm font-semibold"
      >
        <span>{agir ? "⚠️" : "🔔"}</span>
        <span>
          Elle düzeltilmesi gereken {uyarilar.length} konu
          {agir ? ` (${agir} tanesi acil)` : ""}
        </span>
        <span className="ml-auto text-xs text-neutral-500">{acik ? "gizle" : "göster"}</span>
      </button>

      {acik && (
        <ul className="mt-3 space-y-2">
          {uyarilar.map((u, i) => (
            <li key={i} className="text-sm bg-white dark:bg-neutral-900 rounded-lg px-3 py-2">
              <div className="font-medium">
                {u.agir ? "⚠ " : ""}
                {u.ayrinti}
              </div>
              <div className="text-[12px] text-neutral-500 mt-0.5">→ {u.yapilacak}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
