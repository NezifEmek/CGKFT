"use client";

import { useActionState, useState } from "react";
import { kullaniciOlustur } from "./actions";
import type { Sube, Rol } from "@/types/database";

export function KullaniciEkleForm({ subeler }: { subeler: Sube[] }) {
  const [state, action, pending] = useActionState(kullaniciOlustur, null);
  const [rol, setRol] = useState<Rol>("denetmen");

  return (
    <details className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <summary className="cursor-pointer text-sm font-medium">＋ Yeni Kullanıcı Oluştur</summary>
      <form action={action} className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        <input
          name="ad_soyad"
          placeholder="Ad Soyad"
          required
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <input
          name="eposta"
          type="email"
          placeholder="E-posta"
          required
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <input
          name="sifre"
          type="text"
          placeholder="Geçici şifre (en az 8 karakter)"
          required
          minLength={8}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <select
          name="rol"
          value={rol}
          onChange={(e) => setRol(e.target.value as Rol)}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        >
          <option value="denetmen">Denetmen</option>
          <option value="bolge_muduru">Bölge Müdürü</option>
          <option value="genel_mudur">Genel Müdür</option>
          <option value="admin">Admin</option>
        </select>

        {rol === "bolge_muduru" && (
          <input
            name="bolge"
            placeholder="Bölge adı"
            required
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
          />
        )}

        {rol === "denetmen" && (
          <select
            name="sube_id"
            required
            className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
          >
            <option value="">Şube seç…</option>
            {subeler.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ad} ({s.bolge})
              </option>
            ))}
          </select>
        )}

        <div className="col-span-full flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pending ? "Oluşturuluyor…" : "Kullanıcı Oluştur"}
          </button>
          {state?.hata && <span className="text-sm text-red-600">{state.hata}</span>}
        </div>
      </form>
    </details>
  );
}
