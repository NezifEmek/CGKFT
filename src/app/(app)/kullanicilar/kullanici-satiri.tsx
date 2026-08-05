"use client";

import { useActionState, useState } from "react";
import {
  profilGuncelle,
  epostaGuncelle,
  sifreBelirle,
  sifreSifirlamaGonder,
  erisimDegistir,
  kullaniciSil,
} from "./yonetim-actions";
import { ROL_ETIKET, type Rol } from "@/types/database";
import { YetkiPaneli, type YetkiVerisi, type YetkiSube, type YetkiPozisyon } from "./yetki-paneli";

const girdiSinif =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";

const ROLLER: Rol[] = ["admin", "genel_mudur", "bolge_muduru", "denetmen"];

export interface KullaniciSatiriVerisi {
  id: string;
  adSoyad: string;
  rol: Rol;
  bolge: string | null;
  eposta: string;
  sonGiris: string | null;
  /** Panelde en son işlem yapılan an — asıl "kullanıyor mu" ölçüsü (0026). */
  sonHareket: string | null;
  engelliMi: boolean;
  denetimSayisi: number;
  skorSayisi: number;
  yetki: YetkiVerisi;
}

function tarihFmt(s: string | null): string {
  if (!s) return "hiç giriş yapmamış";
  return new Date(s).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * "3 dakika önce", "2 gün önce" gibi okunur mesafe.
 *
 * Ham tarihten daha hızlı okunuyor: yönetici listeye bakarken "kim aktif,
 * kim değil" sorusunu saniyede cevaplamak istiyor.
 */
function gecenSure(s: string | null, simdi: number): string {
  if (!s) return "—";
  const fark = simdi - new Date(s).getTime();
  if (!Number.isFinite(fark) || fark < 0) return "az önce";
  const dk = Math.floor(fark / 60000);
  if (dk < 2) return "az önce";
  if (dk < 60) return `${dk} dakika önce`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} saat önce`;
  const gun = Math.floor(saat / 24);
  if (gun === 1) return "dün";
  if (gun < 30) return `${gun} gün önce`;
  const ay = Math.floor(gun / 30);
  return ay < 12 ? `${ay} ay önce` : `${Math.floor(ay / 12)} yıl önce`;
}

/** Son hareket ne kadar eskiyse o kadar soluk gösteriliyor. */
function hareketRengi(s: string | null, simdi: number): string {
  if (!s) return "text-neutral-400";
  const gun = (simdi - new Date(s).getTime()) / 86400000;
  if (gun < 1) return "text-emerald-600 font-medium";
  if (gun < 7) return "text-neutral-700 dark:text-neutral-300";
  if (gun < 30) return "text-amber-600";
  return "text-red-500";
}

export function KullaniciSatiri({
  k,
  bolgeler,
  subeler,
  pozisyonlar,
  benMiyim,
  simdi,
}: {
  k: KullaniciSatiriVerisi;
  /** Sayfa oluşturulduğu an — tüm satırlar aynı ana göre "x gün önce" der. */
  simdi: number;
  bolgeler: string[];
  subeler: YetkiSube[];
  pozisyonlar: YetkiPozisyon[];
  benMiyim: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [silOnay, setSilOnay] = useState(false);

  const [profilDurum, profilAction, profilPending] = useActionState(profilGuncelle, null);
  const [epostaDurum, epostaAction, epostaPending] = useActionState(epostaGuncelle, null);
  const [sifreDurum, sifreAction, sifrePending] = useActionState(sifreBelirle, null);
  const [postaDurum, postaAction, postaPending] = useActionState(sifreSifirlamaGonder, null);
  const [erisimDurum, erisimAction, erisimPending] = useActionState(erisimDegistir, null);
  const [silDurum, silAction, silPending] = useActionState(kullaniciSil, null);

  const durum =
    profilDurum ?? epostaDurum ?? sifreDurum ?? postaDurum ?? erisimDurum ?? silDurum;

  const [rol, setRol] = useState<Rol>(k.rol);

  return (
    <>
      <tr className="border-t border-neutral-100 dark:border-neutral-800">
        <td className="px-4 py-2">
          <button
            type="button"
            onClick={() => setAcik((v) => !v)}
            className="text-left hover:underline font-medium"
          >
            {acik ? "▾" : "▸"} {k.adSoyad || "—"}
          </button>
          {benMiyim && <span className="ml-2 text-[10px] text-neutral-400">(siz)</span>}
          {!benMiyim && (
            // Bağlantı (GET) — görüntüleme modundayken POST'lar kapalı olduğu
            // için form kullanılamaz.
            <a
              href={`/goruntuleme?kisi=${k.id}`}
              title={`${k.adSoyad} olarak görüntüle (salt okunur)`}
              className="ml-2 text-[11px] text-neutral-500 hover:underline"
            >
              👁️ gibi görüntüle
            </a>
          )}
        </td>
        <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{k.eposta || "—"}</td>
        <td className="px-4 py-2">{ROL_ETIKET[k.rol]}</td>
        <td className="px-4 py-2 text-neutral-500">{k.bolge || "—"}</td>
        {/* Asıl ölçü SON HAREKET. "Son giriş" altta küçük duruyor: oturum
            açık kaldıkça değişmediği için tek başına yanıltıcıydı — kişi
            günlerdir çalışıyorken "5 gündür girmemiş" görünüyordu (0026). */}
        <td className="px-4 py-2 text-xs">
          <span className={hareketRengi(k.sonHareket, simdi)}>
            {gecenSure(k.sonHareket, simdi)}
          </span>
          {k.sonHareket && (
            <span className="block text-[10px] text-neutral-400">
              {tarihFmt(k.sonHareket)}
            </span>
          )}
          <span className="block text-[10px] text-neutral-400">
            giriş: {k.sonGiris ? tarihFmt(k.sonGiris) : "hiç"}
          </span>
        </td>
        <td className="px-4 py-2">
          {k.engelliMi ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-medium">
              girişi kapalı
            </span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              aktif
            </span>
          )}
        </td>
      </tr>

      {acik && (
        <tr className="border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/40">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid md:grid-cols-2 gap-5 max-w-4xl">
              {/* Ad / rol / bölge */}
              <form action={profilAction} className="space-y-2">
                <input type="hidden" name="kullanici_id" value={k.id} />
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Bilgiler
                </p>
                <label className="block">
                  <span className="block text-xs text-neutral-500 mb-1">Ad Soyad</span>
                  <input
                    name="ad_soyad"
                    defaultValue={k.adSoyad}
                    className={girdiSinif + " w-full"}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-neutral-500 mb-1">Rol</span>
                  <select
                    name="rol"
                    value={rol}
                    onChange={(e) => setRol(e.target.value as Rol)}
                    className={girdiSinif + " w-full"}
                  >
                    {ROLLER.map((r) => (
                      <option key={r} value={r}>
                        {ROL_ETIKET[r]}
                      </option>
                    ))}
                  </select>
                </label>
                {rol === "bolge_muduru" && (
                  <label className="block">
                    <span className="block text-xs text-neutral-500 mb-1">Bölge</span>
                    <input
                      name="bolge"
                      defaultValue={k.bolge ?? ""}
                      list={`bolgeler-${k.id}`}
                      className={girdiSinif + " w-full"}
                    />
                    <datalist id={`bolgeler-${k.id}`}>
                      {bolgeler.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </label>
                )}
                <button
                  type="submit"
                  disabled={profilPending}
                  className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                >
                  {profilPending ? "Kaydediliyor…" : "Bilgileri kaydet"}
                </button>
              </form>

              {/* E-posta */}
              <form action={epostaAction} className="space-y-2">
                <input type="hidden" name="kullanici_id" value={k.id} />
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                  E-posta
                </p>
                <label className="block">
                  <span className="block text-xs text-neutral-500 mb-1">Giriş adresi</span>
                  <input
                    name="eposta"
                    type="email"
                    defaultValue={k.eposta}
                    className={girdiSinif + " w-full"}
                  />
                </label>
                <button
                  type="submit"
                  disabled={epostaPending}
                  className={girdiSinif}
                >
                  {epostaPending ? "Değiştiriliyor…" : "E-postayı değiştir"}
                </button>
                <p className="text-[11px] text-neutral-400">
                  Değiştirdiğinizde kullanıcı yeni adresle giriş yapar; doğrulama beklenmez.
                </p>
              </form>

              {/* Şifre */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Şifre</p>
                <div className="rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-[11px] text-neutral-500 leading-relaxed">
                  Mevcut şifre <b>hiç kimse tarafından görüntülenemez</b> — veritabanında geri
                  çevrilemez biçimde saklanıyor. Yapılabilecek iki şey var:
                </div>

                <form action={postaAction} className="space-y-1">
                  <input type="hidden" name="eposta" value={k.eposta} />
                  <button
                    type="submit"
                    disabled={postaPending || !k.eposta}
                    className={girdiSinif + " w-full disabled:opacity-60"}
                  >
                    {postaPending ? "Gönderiliyor…" : "① Şifre belirleme e-postası gönder"}
                  </button>
                  <p className="text-[11px] text-neutral-400">
                    Tercih edilen yol: şifreyi kullanıcı kendi belirler, siz görmezsiniz.
                  </p>
                </form>

                <form action={sifreAction} className="space-y-1">
                  <input type="hidden" name="kullanici_id" value={k.id} />
                  <label className="block">
                    <span className="block text-xs text-neutral-500 mb-1">
                      ② Geçici şifre belirle (en az 8 karakter)
                    </span>
                    <input
                      name="yeni_sifre"
                      type="text"
                      minLength={8}
                      placeholder="örn. Cigkofte2026!"
                      className={girdiSinif + " w-full font-mono"}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={sifrePending}
                    className={girdiSinif + " disabled:opacity-60"}
                  >
                    {sifrePending ? "Değiştiriliyor…" : "Şifreyi değiştir"}
                  </button>
                  <p className="text-[11px] text-neutral-400">
                    E-postaya erişilemiyorsa kullanın. Kullanıcıya güvenli bir kanaldan iletin ve
                    girişten sonra değiştirmesini isteyin.
                  </p>
                </form>
              </div>

              {/* Erişim / silme */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                  Erişim
                </p>

                <form action={erisimAction}>
                  <input type="hidden" name="kullanici_id" value={k.id} />
                  <input type="hidden" name="kapat" value={k.engelliMi ? "0" : "1"} />
                  <button
                    type="submit"
                    disabled={erisimPending || (benMiyim && !k.engelliMi)}
                    className={girdiSinif + " w-full disabled:opacity-60"}
                  >
                    {erisimPending
                      ? "İşleniyor…"
                      : k.engelliMi
                        ? "🔓 Girişi yeniden aç"
                        : "🔒 Girişi kapat"}
                  </button>
                </form>
                <p className="text-[11px] text-neutral-400">
                  Girişi kapatmak, silmenin güvenli alternatifi: kullanıcı giremez ama denetim ve
                  skor kayıtları yerinde kalır.
                </p>

                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
                  {k.denetimSayisi + k.skorSayisi > 0 ? (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Silinemez: adına {k.denetimSayisi} denetim, {k.skorSayisi} skor kayıtlı.
                      Silinirse bu kayıtlar da giderdi.
                    </p>
                  ) : silOnay ? (
                    <form action={silAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="kullanici_id" value={k.id} />
                      <span className="text-xs text-red-600">Emin misiniz?</span>
                      <button
                        type="submit"
                        disabled={silPending}
                        className="rounded-md bg-red-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-60"
                      >
                        {silPending ? "Siliniyor…" : "Evet, kalıcı olarak sil"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSilOnay(false)}
                        className={girdiSinif}
                      >
                        Vazgeç
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSilOnay(true)}
                      disabled={benMiyim}
                      className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      🗑 Kullanıcıyı sil
                    </button>
                  )}
                </div>
              </div>
            </div>

            {durum?.ok && (
              <p className="text-sm text-emerald-600 mt-3 max-w-4xl">✓ {durum.ok}</p>
            )}
            {durum?.hata && <p className="text-sm text-red-600 mt-3 max-w-4xl">{durum.hata}</p>}

            <div className="mt-5 pt-4 border-t-2 border-neutral-200 dark:border-neutral-700">
              <p className="text-sm font-semibold mb-3">🔐 Yetkilendirme</p>
              <YetkiPaneli
                k={k.yetki}
                bolgeler={bolgeler}
                subeler={subeler}
                pozisyonlar={pozisyonlar}
                benMiyim={benMiyim}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
