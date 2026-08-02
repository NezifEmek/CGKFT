"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { planEkle, planDurum, planSil, planKopyala, PLAN_TURLERI, TUR_ETIKET } from "./actions";
import { faaliyetMetni, type KisiFaaliyet } from "@/lib/faaliyet";
import { tarihYaz, type Hafta } from "@/lib/hafta";

const gir =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";
const kart =
  "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900";
const btn =
  "rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3.5 py-1.5 text-sm font-medium disabled:opacity-60";
const btnSade =
  "rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm disabled:opacity-60";

const SONUC_RENK: Record<string, string> = {
  gerceklesti: "#16a34a",
  gerceklesmedi: "#dc2626",
  ertelendi: "#f59e0b",
};
const SONUC_ISARET: Record<string, string> = {
  gerceklesti: "✔",
  gerceklesmedi: "✘",
  ertelendi: "↻",
};
const SONUC_ETIKET: Record<string, string> = {
  gerceklesti: "Gerçekleşti",
  gerceklesmedi: "Gerçekleşmedi",
  ertelendi: "Ertelendi",
};

function gunKisa(t: string | null): string {
  if (!t) return "";
  return `${t.slice(8, 10)}.${t.slice(5, 7)}`;
}

export function FaaliyetArayuz({
  hafta,
  haftalar,
  kisiler,
  subeler,
  benId,
  duzenleyebilir,
  gecenHafta,
  tabloYok,
}: {
  hafta: Hafta;
  haftalar: Hafta[];
  kisiler: KisiFaaliyet[];
  subeler: { id: string; ad: string }[];
  benId: string;
  duzenleyebilir: boolean;
  gecenHafta: string;
  tabloYok: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [acikKisi, setAcikKisi] = useState<string | null>(null);
  const [planAcik, setPlanAcik] = useState<string | null>(null);
  const [sadeceFaal, setSadeceFaal] = useState(false);

  const [d1, a1, p1] = useActionState(planEkle, null);
  const [d2, a2, p2] = useActionState(planDurum, null);
  const [d3, a3, p3] = useActionState(planSil, null);
  const [d4, a4, p4] = useActionState(planKopyala, null);
  const durum = d1 ?? d2 ?? d3 ?? d4;

  function haftaDegistir(baslangic: string) {
    const y = new URLSearchParams(sp.toString());
    y.set("hafta", baslangic);
    router.push(`/haftalik-faaliyet?${y.toString()}`);
  }

  const listelenen = useMemo(
    () => (sadeceFaal ? kisiler.filter((k) => k.toplamFaaliyet || k.planToplam) : kisiler),
    [kisiler, sadeceFaal],
  );

  const ozet = useMemo(() => {
    const z = kisiler.reduce((t, k) => t + k.ziyaretler.length, 0);
    const pt = kisiler.reduce((t, k) => t + k.planToplam, 0);
    const pg = kisiler.reduce((t, k) => t + k.planGerceklesen, 0);
    const g = kisiler.reduce((t, k) => t + k.gecikenGorevler.length, 0);
    const faal = kisiler.filter((k) => k.toplamFaaliyet).length;
    return { z, pt, pg, g, faal };
  }, [kisiler]);

  function metniIndir() {
    const metin = faaliyetMetni(hafta, kisiler);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([metin], { type: "text/plain;charset=utf-8" }));
    a.download = `faaliyet-${hafta.baslangic}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      {/* ── Hafta seçimi ve özet ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={hafta.baslangic} onChange={(e) => haftaDegistir(e.target.value)} className={gir}>
          {haftalar.map((h, i) => (
            <option key={h.baslangic} value={h.baslangic}>
              {h.etiket}
              {i === 0 ? " — gelecek hafta" : i === 1 ? " — bu hafta" : ""}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-neutral-500">
          <input type="checkbox" checked={sadeceFaal} onChange={(e) => setSadeceFaal(e.target.checked)} />
          Yalnızca hareketi olanlar
        </label>
        <button type="button" onClick={metniIndir} className={btnSade + " ml-auto"}>
          ⬇ Rapor metni (.txt)
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { s: ozet.z, e: "Ziyaret / denetim" },
          { s: `${ozet.pg}/${ozet.pt}`, e: "Plan gerçekleşen" },
          { s: ozet.faal, e: "Hareketi olan kişi" },
          { s: kisiler.length - ozet.faal, e: "Kaydı olmayan" },
          { s: ozet.g, e: "Geciken görev", r: ozet.g ? "#dc2626" : undefined },
        ].map((x) => (
          <div key={x.e} className={kart + " p-3 text-center"}>
            <div className="text-lg font-extrabold" style={{ color: x.r }}>{x.s}</div>
            <div className="text-[10px] text-neutral-500">{x.e}</div>
          </div>
        ))}
      </div>

      {tabloYok && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          <b>Plan tablosu henüz oluşturulmamış.</b> Faaliyetler (denetim, franchise, toplantı, görev)
          yine görünüyor; yalnızca <b>plan girişi</b> için{" "}
          <code className="text-xs">0011_haftalik_plan.sql</code> çalıştırılmalı.
        </div>
      )}

      {durum?.ok && <p className="text-sm text-emerald-600">✓ {durum.ok}</p>}
      {durum?.hata && <p className="text-sm text-red-600">{durum.hata}</p>}

      {/* ── Kişi kartları ────────────────────────────────────────── */}
      <div className="space-y-2">
        {listelenen.map((k) => {
          const acik = acikKisi === k.profilId;
          const kendiVeyaYetkili = duzenleyebilir || k.profilId === benId;
          return (
            <div key={k.profilId} className={kart + " overflow-hidden"}>
              <button
                type="button"
                onClick={() => setAcikKisi(acik ? null : k.profilId)}
                className="w-full text-left px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
              >
                <span className="font-medium text-[15px]">{k.ad}</span>

                {k.planToplam > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                    plan {k.planGerceklesen}/{k.planToplam}
                  </span>
                )}
                {k.ziyaretler.length > 0 && (
                  <span className="text-xs text-neutral-500">🏪 {k.ziyaretler.length} ziyaret</span>
                )}
                {k.franchiseAramalari.length > 0 && (
                  <span className="text-xs text-neutral-500">📨 {k.franchiseAramalari.length} arama</span>
                )}
                {k.toplantilar.length > 0 && (
                  <span className="text-xs text-neutral-500">🗓️ {k.toplantilar.length} toplantı</span>
                )}
                {k.tamamlananGorevler.length > 0 && (
                  <span className="text-xs text-neutral-500">✔ {k.tamamlananGorevler.length} görev</span>
                )}
                {k.gecikenGorevler.length > 0 && (
                  <span className="text-xs text-red-600 font-medium">
                    ⚠ {k.gecikenGorevler.length} geciken
                  </span>
                )}
                {!k.toplamFaaliyet && !k.planToplam && (
                  <span className="text-xs text-neutral-400">bu hafta kayıt yok</span>
                )}
                <span className="ml-auto text-neutral-400 text-xs">{acik ? "▲" : "▼"}</span>
              </button>

              {acik && (
                <div className="px-4 pb-4 pt-1 border-t border-neutral-100 dark:border-neutral-800 space-y-4">
                  {/* Plan */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                        Plan
                      </h4>
                      {kendiVeyaYetkili && !tabloYok && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setPlanAcik(planAcik === k.profilId ? null : k.profilId)}
                            className="text-xs text-neutral-500 hover:underline"
                          >
                            ＋ plana ekle
                          </button>
                          <form action={a4}>
                            <input type="hidden" name="profil_id" value={k.profilId} />
                            <input type="hidden" name="hafta" value={hafta.baslangic} />
                            <input type="hidden" name="kaynak_hafta" value={gecenHafta} />
                            <button type="submit" disabled={p4} className="text-xs text-neutral-500 hover:underline">
                              geçen haftayı kopyala
                            </button>
                          </form>
                        </div>
                      )}
                    </div>

                    {planAcik === k.profilId && (
                      <form action={a1} className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 p-3 mb-2 space-y-2">
                        <input type="hidden" name="profil_id" value={k.profilId} />
                        <input type="hidden" name="hafta" value={hafta.baslangic} />
                        <div className="grid sm:grid-cols-4 gap-2">
                          <select name="tur" defaultValue="ziyaret" className={gir}>
                            {PLAN_TURLERI.map((t) => (
                              <option key={t} value={t}>{TUR_ETIKET[t]}</option>
                            ))}
                          </select>
                          <select name="sube_id" defaultValue="" className={gir + " sm:col-span-2"}>
                            <option value="">— şube seçin (ya da aşağıya yazın) —</option>
                            {subeler.map((s) => (
                              <option key={s.id} value={s.id}>{s.ad}</option>
                            ))}
                          </select>
                          <input
                            name="gun"
                            type="date"
                            min={hafta.baslangic}
                            max={hafta.bitis}
                            className={gir}
                          />
                        </div>
                        <input name="baslik" placeholder="Şube dışı iş (şube seçtiyseniz boş bırakın)" className={gir + " w-full"} />
                        <input name="aciklama" placeholder="Açıklama" className={gir + " w-full"} />
                        <button type="submit" disabled={p1} className={btn}>Plana ekle</button>
                      </form>
                    )}

                    {k.plan.length ? (
                      <ul className="space-y-1">
                        {k.plan.map((p) => (
                          <li
                            key={p.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-100 dark:border-neutral-800 px-3 py-1.5"
                          >
                            <span style={{ color: SONUC_RENK[p.sonuc] }} className="font-bold">
                              {SONUC_ISARET[p.sonuc]}
                            </span>
                            <span className="text-sm">{p.subeAdi}</span>
                            <span className="text-[11px] text-neutral-400">
                              {TUR_ETIKET[p.tur] ?? p.tur}
                              {p.gun ? ` · ${gunKisa(p.gun)}` : " · gün belirtilmemiş"}
                            </span>
                            {p.durum ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                                elle: {SONUC_ETIKET[p.durum]}
                              </span>
                            ) : p.otomatikGerceklesti ? (
                              <span className="text-[10px] text-emerald-600">denetim kaydından</span>
                            ) : null}
                            {p.durum_notu && (
                              <span className="text-[11px] text-neutral-400">· {p.durum_notu}</span>
                            )}

                            {kendiVeyaYetkili && (
                              <span className="ml-auto flex items-center gap-2">
                                <form action={a2} className="flex items-center gap-1">
                                  <input type="hidden" name="plan_id" value={p.id} />
                                  <input type="hidden" name="profil_id" value={k.profilId} />
                                  <select name="durum" defaultValue={p.durum ?? ""} className="text-xs rounded border border-neutral-200 dark:border-neutral-700 bg-transparent px-1 py-0.5">
                                    <option value="">otomatik</option>
                                    <option value="gerceklesti">gerçekleşti</option>
                                    <option value="gerceklesmedi">gerçekleşmedi</option>
                                    <option value="ertelendi">ertelendi</option>
                                  </select>
                                  <input
                                    name="durum_notu"
                                    defaultValue={p.durum_notu}
                                    placeholder="not"
                                    className="text-xs rounded border border-neutral-200 dark:border-neutral-700 bg-transparent px-1 py-0.5 w-24"
                                  />
                                  <button type="submit" disabled={p2} className="text-xs text-neutral-500 hover:underline">
                                    kaydet
                                  </button>
                                </form>
                                <form action={a3}>
                                  <input type="hidden" name="plan_id" value={p.id} />
                                  <input type="hidden" name="profil_id" value={k.profilId} />
                                  <button type="submit" disabled={p3} className="text-xs text-red-500 hover:underline">
                                    sil
                                  </button>
                                </form>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-neutral-400">Bu hafta için plan girilmemiş.</p>
                    )}

                    {k.plansizZiyaret > 0 && (
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Planda olmayan {k.plansizZiyaret} şube ziyaret edilmiş.
                      </p>
                    )}
                  </div>

                  {/* Gerçekleşen faaliyet */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {k.ziyaretler.length > 0 && (
                      <Bolum baslik="Ziyaret / denetim">
                        {k.ziyaretler.map((z, i) => (
                          <li key={z.subeId + z.tarih + i} className="flex gap-2">
                            <span className="text-neutral-400 w-11 shrink-0">{gunKisa(z.tarih)}</span>
                            <Link href={`/subeler/${z.subeId}`} className="hover:underline flex-1 min-w-0 truncate">
                              {z.subeAdi}
                            </Link>
                            <span className="text-neutral-500 shrink-0">
                              {z.puan != null ? `${z.puan}` : "—"}
                              <span className="text-neutral-400 text-[10px] ml-1">
                                {z.tur === "skor" ? "hızlı" : "denetim"}
                              </span>
                            </span>
                          </li>
                        ))}
                      </Bolum>
                    )}

                    {k.franchiseAramalari.length > 0 && (
                      <Bolum baslik="Franchise araması">
                        {k.franchiseAramalari.map((f) => (
                          <li key={f.id} className="flex gap-2">
                            <span className="text-neutral-400 w-11 shrink-0">{gunKisa(f.tarih)}</span>
                            <span className="flex-1 min-w-0 truncate">{f.etiket}</span>
                            <span className="text-neutral-400 text-[10px] shrink-0">{f.durum}</span>
                          </li>
                        ))}
                      </Bolum>
                    )}

                    {k.toplantilar.length > 0 && (
                      <Bolum baslik="Toplantı katılımı">
                        {k.toplantilar.map((t) => (
                          <li key={t.id} className="flex gap-2">
                            <span className="text-neutral-400 w-11 shrink-0">{gunKisa(t.tarih)}</span>
                            <Link href="/toplantilar" className="hover:underline">
                              {t.no} numaralı toplantı
                            </Link>
                          </li>
                        ))}
                      </Bolum>
                    )}

                    {k.tamamlananGorevler.length > 0 && (
                      <Bolum baslik="Tamamlanan görev">
                        {k.tamamlananGorevler.map((g) => (
                          <li key={g.id} className="flex gap-2">
                            <span className="text-emerald-600 shrink-0">✔</span>
                            <span className="flex-1 min-w-0">{g.baslik}</span>
                          </li>
                        ))}
                      </Bolum>
                    )}

                    {k.gecikenGorevler.length > 0 && (
                      <Bolum baslik="Geciken görev">
                        {k.gecikenGorevler.map((g) => (
                          <li key={g.id} className="flex gap-2">
                            <span className="text-red-600 shrink-0">!</span>
                            <span className="flex-1 min-w-0">{g.baslik}</span>
                            <span className="text-neutral-400 text-[10px] shrink-0">
                              termin {tarihYaz(g.termin)}
                            </span>
                          </li>
                        ))}
                      </Bolum>
                    )}

                    {k.oneriler.length > 0 && (
                      <Bolum baslik="Verdiği öneri">
                        {k.oneriler.map((o) => (
                          <li key={o.id}>💡 {o.baslik}</li>
                        ))}
                      </Bolum>
                    )}
                  </div>

                  {!k.toplamFaaliyet && (
                    <p className="text-sm text-neutral-400">
                      Bu hafta hiçbir modülde kayıt bulunmuyor. Faaliyet yapılmadıysa normal;
                      yapıldıysa ilgili ekranlara girilmemiş demektir.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!listelenen.length && (
          <div className={kart + " text-center text-sm text-neutral-400 py-8"}>
            Gösterilecek kişi yok.
          </div>
        )}
      </div>
    </div>
  );
}

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">{baslik}</h4>
      <ul className="space-y-0.5 text-sm">{children}</ul>
    </div>
  );
}
