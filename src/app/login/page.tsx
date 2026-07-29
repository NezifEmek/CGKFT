"use client";

import { useActionState } from "react";
import { girisYap } from "./actions";

export default function GirisSayfasi() {
  const [state, action, pending] = useActionState(girisYap, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
      <form
        action={action}
        className="w-full max-w-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 shadow-sm"
      >
        <h1 className="text-lg font-semibold mb-1">Çiğköfte Satış Paneli</h1>
        <p className="text-sm text-neutral-500 mb-6">Devam etmek için giriş yapın.</p>

        <label className="block text-sm font-medium mb-1" htmlFor="eposta">
          E-posta
        </label>
        <input
          id="eposta"
          name="eposta"
          type="email"
          required
          autoComplete="username"
          className="w-full mb-4 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
        />

        <label className="block text-sm font-medium mb-1" htmlFor="sifre">
          Şifre
        </label>
        <input
          id="sifre"
          name="sifre"
          type="password"
          required
          autoComplete="current-password"
          className="w-full mb-4 rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
        />

        {state?.hata && (
          <p className="mb-4 text-sm text-red-600 dark:text-red-400">{state.hata}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 py-2 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}
