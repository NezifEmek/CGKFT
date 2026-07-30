"use client";

import { useActionState, useState } from "react";
import { pozisyonKaydet, pozisyonSifirla, pozisyonSil, pozisyonEkle } from "./actions";
import { POZISYON_ALANLARI, DISA_AKTARIM_SIRASI, ALAN_BASLIK, type Pozisyon } from "@/lib/dokuman";

const MARKA_RENK = "#c0392b";

const girdiSinif =
  "w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-1.5 text-sm";

/** Metin alanındaki her satırı madde işaretli listeye çevirir (eski docexport.js ile aynı). */
function alanHtml(deger: string): string {
  const satirlar = String(deger || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!satirlar.length) {
    return `<p style="color:#94a3b8;font-style:italic;margin:0">—</p>`;
  }
  const li = satirlar
    .map((s) => `<li style="margin-bottom:3px">${kacir(s.replace(/^[•\-*]\s*/, ""))}</li>`)
    .join("");
  return `<ul style="margin:0;padding-left:18px">${li}</ul>`;
}

function kacir(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pozisyonHtml(p: Pozisyon): string {
  const ust = [
    p.adSoyad && `<b>Ad Soyad:</b> ${kacir(p.adSoyad)}`,
    p.bagliKisi && `<b>Bağlı Olduğu Kişi:</b> ${kacir(p.bagliKisi)}`,
    p.yedek && `<b>Yedek Sorumlusu:</b> ${kacir(p.yedek)}`,
  ].filter(Boolean);

  const bolumler = DISA_AKTARIM_SIRASI.map(
    (k) => `
      <div style="margin:0 0 14px">
        <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;
          color:${MARKA_RENK};border-bottom:2px solid ${MARKA_RENK};padding-bottom:3px;margin-bottom:6px">
          ${kacir(ALAN_BASLIK[k] ?? String(k))}
        </div>
        ${alanHtml(String(p[k] ?? ""))}
      </div>`,
  ).join("");

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1e293b;max-width:760px">
      <div style="background:#1b2030;color:#fff;padding:14px 18px;margin-bottom:16px">
        <div style="font-size:17px;font-weight:700">Adıyaman Çiğköfte</div>
        <div style="font-size:11px;opacity:.75">Ramazan Altuğ Gıda İnşaat Pazarlama San.</div>
      </div>
      <div style="font-size:11px;color:#64748b;margin-bottom:2px">GÖREV TANIMI · POZİSYON ${p.sira}</div>
      <h1 style="font-size:19px;color:${MARKA_RENK};margin:0 0 10px">${kacir(p.unvan)}</h1>
      ${ust.length ? `<p style="margin:0 0 14px;font-size:13px;color:#475569">${ust.join(" &nbsp;·&nbsp; ")}</p>` : ""}
      ${bolumler}
    </div>`;
}

function wordIndir(parcalar: string[], dosyaAd: string) {
  // .doc uzantılı HTML — Word bunu sorunsuz açar, ek kütüphane gerekmez.
  const govde = parcalar.join(
    `<br clear="all" style="page-break-before:always" />`,
  );
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8" /><title>${kacir(dosyaAd)}</title></head>
    <body>${govde}</body></html>`;

  const blob = new Blob(["﻿", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAd + ".doc";
  a.click();
  URL.revokeObjectURL(url);
}

function yazdir(icerik: string) {
  const pencere = window.open("", "_blank", "width=820,height=900");
  if (!pencere) {
    alert("Yazdırma penceresi açılamadı — tarayıcı açılır pencereyi engellemiş olabilir.");
    return;
  }
  pencere.document.write(
    `<html><head><meta charset="utf-8" /><title>Görev Tanımı</title></head><body>${icerik}</body></html>`,
  );
  pencere.document.close();
  pencere.focus();
  pencere.print();
}

export function DokumanArayuz({
  pozisyonlar,
  duzenlenebilir,
}: {
  pozisyonlar: Pozisyon[];
  duzenlenebilir: boolean;
}) {
  const [aktifId, setAktifId] = useState(pozisyonlar[0]?.id ?? "");
  const [kaydetDurum, kaydetAction, kaydetPending] = useActionState(pozisyonKaydet, null);
  const [sifirlaDurum, sifirlaAction, sifirlaPending] = useActionState(pozisyonSifirla, null);
  const [silDurum, silAction, silPending] = useActionState(pozisyonSil, null);
  const [ekleDurum, ekleAction, eklePending] = useActionState(pozisyonEkle, null);

  const aktif = pozisyonlar.find((p) => p.id === aktifId) ?? pozisyonlar[0];
  const durum = kaydetDurum ?? sifirlaDurum ?? silDurum ?? ekleDurum;

  if (!aktif) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-8 text-center text-sm text-neutral-500">
        Görev tanımı bulunamadı.
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-4">
      {/* Pozisyon listesi */}
      <aside className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden self-start">
        <div className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-neutral-500 border-b border-neutral-100 dark:border-neutral-800">
          Pozisyonlar ({pozisyonlar.length})
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {pozisyonlar.map((p) => {
            const seciliMi = p.id === aktif.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setAktifId(p.id)}
                className={`block w-full text-left px-3.5 py-2.5 text-[13px] leading-tight border-l-[3px] transition-colors ${
                  seciliMi
                    ? "border-red-700 bg-red-50 dark:bg-red-950/30 font-semibold text-red-800 dark:text-red-300"
                    : "border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                }`}
              >
                <span className="block text-[10px] text-neutral-400">Pozisyon {p.sira}</span>
                {p.unvan}
                {p.adSoyad && (
                  <span className="block text-[11px] text-neutral-400 font-normal">{p.adSoyad}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-neutral-100 dark:border-neutral-800 p-2 space-y-2">
          <button
            type="button"
            onClick={() =>
              wordIndir(pozisyonlar.map(pozisyonHtml), "Gorev-Tanimlari-Tumu")
            }
            className="w-full rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            📑 Tümünü Word&apos;de indir
          </button>
          {duzenlenebilir && (
            <form action={ekleAction}>
              <button
                type="submit"
                disabled={eklePending}
                className="w-full rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60"
              >
                {eklePending ? "Ekleniyor…" : "+ Yeni pozisyon ekle"}
              </button>
            </form>
          )}
        </div>
      </aside>

      {/* Form */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
        <form action={kaydetAction} className="space-y-4">
          <input type="hidden" name="pozisyon_id" value={aktif.id} />

          <div className="flex flex-wrap items-center gap-2">
            {duzenlenebilir && (
              <button
                type="submit"
                disabled={kaydetPending}
                className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {kaydetPending ? "Kaydediliyor…" : "💾 Kaydet"}
              </button>
            )}
            <button
              type="button"
              onClick={() => yazdir(pozisyonHtml(aktif))}
              className={girdiSinif + " w-auto"}
            >
              🖨️ Yazdır / PDF
            </button>
            <button
              type="button"
              onClick={() =>
                wordIndir([pozisyonHtml(aktif)], "Gorev-Tanimi-" + aktif.sira)
              }
              className={girdiSinif + " w-auto"}
            >
              📝 Word olarak indir
            </button>
            {durum?.ok && <span className="text-sm text-emerald-600">✓ {durum.ok}</span>}
            {durum?.hata && <span className="text-sm text-red-600">{durum.hata}</span>}
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Unvan / Pozisyon Adı</label>
            <input
              name="unvan"
              key={aktif.id + "-unvan"}
              defaultValue={aktif.unvan}
              readOnly={!duzenlenebilir}
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-2.5 py-2 text-[15px] font-bold text-red-800 dark:text-red-300"
            />
          </div>

          {POZISYON_ALANLARI.map((alan) => (
            <div key={alan.key}>
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
                {alan.etiket}
              </label>
              {alan.cokSatir ? (
                <textarea
                  name={alan.key}
                  // key: pozisyon değişince defaultValue yeniden uygulanmalı.
                  key={aktif.id + "-" + alan.key}
                  defaultValue={String(aktif[alan.key] ?? "")}
                  rows={alan.satir ?? 4}
                  readOnly={!duzenlenebilir}
                  className={girdiSinif}
                />
              ) : (
                <input
                  name={alan.key}
                  key={aktif.id + "-" + alan.key}
                  defaultValue={String(aktif[alan.key] ?? "")}
                  readOnly={!duzenlenebilir}
                  className={girdiSinif}
                />
              )}
            </div>
          ))}
        </form>

        {duzenlenebilir && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <form action={sifirlaAction}>
              <input type="hidden" name="pozisyon_id" value={aktif.id} />
              <button type="submit" disabled={sifirlaPending} className={girdiSinif + " w-auto"}>
                ↩ Bu pozisyonu orijinaline döndür
              </button>
            </form>
            <form action={silAction} className="ml-auto">
              <input type="hidden" name="pozisyon_id" value={aktif.id} />
              <button
                type="submit"
                disabled={silPending}
                className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-2.5 py-1.5 text-sm disabled:opacity-60"
              >
                🗑 Pozisyonu sil
              </button>
            </form>
          </div>
        )}

        {!duzenlenebilir && (
          <p className="text-xs text-neutral-400 mt-4">
            Görev tanımlarını yalnızca admin ve genel müdür değiştirebilir. Yazdırma ve Word
            indirme her rolde açık.
          </p>
        )}
      </section>
    </div>
  );
}
