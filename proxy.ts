import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { GORUNTULEME_CEREZI, postSerbestMi } from "@/lib/goruntuleme";

// Next.js 16: "Middleware" dosyası artık "Proxy" olarak adlandırılıyor
// (davranış aynı) — bkz. node_modules/next/dist/docs/.../16-proxy.md
export async function proxy(request: NextRequest) {
  // ── Görüntüleme modu: yazma yok ──────────────────────────────────────
  // "Şu kullanıcı gibi görüntüle" açıkken oturum hâlâ admin'in oturumu;
  // yapılan bir kayıt admin adına düşer ama ekranda başkasının adı yazar.
  // Bu karışıklığı doğurmamak için tüm yazma istekleri burada kesiliyor.
  //
  // Tek noktadan engelleme bilinçli: server action'ların hepsi POST olduğu
  // için otuz küsur eylem dosyasına ayrı ayrı kontrol koymaya gerek yok.
  // Tek tek koysaydım birini atlamak sessiz bir açık bırakırdı.
  if (
    request.method === "POST" &&
    request.cookies.get(GORUNTULEME_CEREZI)?.value &&
    !postSerbestMi(request.nextUrl.pathname)
  ) {
    return new NextResponse(
      "Görüntüleme modundayken değişiklik yapılamaz. Üstteki banttan moddan çıkın.",
      { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
