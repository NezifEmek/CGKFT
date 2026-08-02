import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GORUNTULEME_CEREZI } from "@/lib/goruntuleme";
import type { Profile } from "@/types/database";

/**
 * Görüntüleme moduna giriş/çıkış.
 *
 * GET olarak çalışıyor çünkü bu moddayken POST istekleri proxy tarafından
 * reddediliyor — moddan çıkışın da engellenmesi kullanıcıyı kilitlerdi.
 *
 *   /goruntuleme?kisi=<profil-id>   → moda gir
 *   /goruntuleme?cik=1              → moddan çık
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const anasayfa = new URL("/", request.url);
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // Çıkış her koşulda serbest: kilitli kalmasın.
  if (request.nextUrl.searchParams.get("cik")) {
    const cevap = NextResponse.redirect(new URL("/kullanicilar", request.url));
    cevap.cookies.delete(GORUNTULEME_CEREZI);
    return cevap;
  }

  // Girişi yalnızca admin yapabilir.
  const { data: ben } = await supabase
    .from("profiles")
    .select("id, rol")
    .eq("id", user.id)
    .maybeSingle<Pick<Profile, "id" | "rol">>();

  if (!ben || ben.rol !== "admin") return NextResponse.redirect(anasayfa);

  const hedefId = request.nextUrl.searchParams.get("kisi");
  if (!hedefId || hedefId === ben.id) return NextResponse.redirect(anasayfa);

  const admin = createAdminClient();
  const { data: hedef } = await admin
    .from("profiles")
    .select("id")
    .eq("id", hedefId)
    .maybeSingle<{ id: string }>();

  if (!hedef) return NextResponse.redirect(new URL("/kullanicilar", request.url));

  const cevap = NextResponse.redirect(anasayfa);
  cevap.cookies.set(GORUNTULEME_CEREZI, hedef.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Oturum çerezi: tarayıcı kapanınca mod da kapanır. Unutulup açık
    // kalmasındansa yeniden açılması iyi.
    maxAge: undefined,
  });
  return cevap;
}
