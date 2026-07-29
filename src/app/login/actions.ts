"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function girisYap(_onceki: { hata?: string } | null, formData: FormData) {
  const eposta = String(formData.get("eposta") || "").trim();
  const sifre = String(formData.get("sifre") || "");

  if (!eposta || !sifre) {
    return { hata: "E-posta ve şifre gerekli." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: eposta, password: sifre });

  if (error) {
    return { hata: "Giriş başarısız: e-posta veya şifre hatalı." };
  }

  redirect("/");
}
