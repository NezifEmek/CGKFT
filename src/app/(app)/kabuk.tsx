"use client";

// kabuk.tsx — Uygulama çerçevesi: masaüstünde sabit yan menü, telefonda çekmece.
//
// ── Neden ────────────────────────────────────────────────────────────────
// Nezif: "Yazılım cep telefonunda çok iyi görünmüyor. Soldaki menü bar
// mobilde açılır kapanır olabilir mi?"
//
// Yan menü 240 piksel genişliğinde ve her zaman görünürdü. 375 piksellik
// bir telefonda ekranın üçte ikisini kaplıyor, içerik kalan dar sütuna
// sıkışıyordu — başlıklar kelime kelime alt alta düşüyordu.
//
// Artık:
//   md ve üstü (768px+) → eskisi gibi sabit yan menü, hiçbir değişiklik yok
//   telefonda           → menü ekran dışında; üstteki düğmeyle açılıyor
//
// ── Kapanma davranışı ────────────────────────────────────────────────────
// Menüden bir sayfaya gidilince çekmece kendiliğinden kapanmalı, yoksa
// kullanıcı her seferinde elle kapatmak zorunda kalır. Bunu useEffect ile
// yol değişimini dinleyerek değil, menüye yapılan tıklamayı yakalayarak
// yapıyoruz: etkinin içinden setState çağırmak zincirleme render tetikliyor
// ve projede bu bir lint hatası (bkz. yan-menu.tsx'teki aynı gerekçe).

import { useState } from "react";

export function Kabuk({
  yanMenu,
  children,
}: {
  /** Sunucuda hazırlanan menü içeriği (logo, kullanıcı, linkler, çıkış). */
  yanMenu: React.ReactNode;
  children: React.ReactNode;
}) {
  const [acik, setAcik] = useState(false);

  return (
    <div className="min-h-screen md:flex bg-neutral-100 dark:bg-neutral-950">
      {/* ── Telefon üst çubuğu ──────────────────────────────────────── */}
      <header
        className="yazdirma-gizle md:hidden sticky top-0 z-40 flex items-center gap-3 px-3 py-2 border-b border-white/10"
        style={{ background: "#1b2030" }}
      >
        <button
          type="button"
          onClick={() => setAcik(true)}
          aria-label="Menüyü aç"
          aria-expanded={acik}
          // 44px'lik dokunma alanı — parmakla rahat basılsın.
          className="h-11 w-11 -ml-1 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20"
        >
          <span className="flex flex-col gap-[5px]">
            <span className="block h-0.5 w-6 rounded bg-white" />
            <span className="block h-0.5 w-6 rounded bg-white" />
            <span className="block h-0.5 w-6 rounded bg-white" />
          </span>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Adıyaman Çiğköfte" className="h-8 w-auto" />
      </header>

      {/* ── Çekmece perdesi ────────────────────────────────────────── */}
      {acik && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          onClick={() => setAcik(false)}
          className="yazdirma-gizle md:hidden fixed inset-0 z-40 bg-black/50"
        />
      )}

      {/* ── Yan menü ───────────────────────────────────────────────── */}
      <aside
        // Telefonda ekran dışında duruyor, açılınca kayarak geliyor.
        // md'den itibaren dönüşüm sıfırlanıp eski sabit haline dönüyor.
        className={`yazdirma-gizle fixed inset-y-0 left-0 z-50 w-64 flex flex-col
          transition-transform duration-200 ease-out
          md:sticky md:top-0 md:z-auto md:h-screen md:w-60 md:shrink-0 md:translate-x-0
          ${acik ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
        style={{ background: "#1b2030" }}
      >
        {/* Menüdeki bir bağlantıya basılınca çekmece kapansın. Tek tek her
            linke onClick eklemek yerine tıklama burada yakalanıyor; menü
            içeriği sunucuda üretildiği için tek yol bu. */}
        <div
          className="flex flex-col h-full min-h-0"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setAcik(false);
          }}
        >
          {/* Telefonda çekmecenin kendi kapatma düğmesi */}
          <button
            type="button"
            onClick={() => setAcik(false)}
            aria-label="Menüyü kapat"
            className="md:hidden absolute top-2 right-2 h-9 w-9 flex items-center justify-center rounded-lg text-white/70 hover:bg-white/10"
          >
            ✕
          </button>
          {yanMenu}
        </div>
      </aside>

      {/* ── İçerik ─────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 p-4 sm:p-5 md:p-7">{children}</main>
    </div>
  );
}
