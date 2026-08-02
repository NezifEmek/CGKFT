// PostgREST/Supabase varsayılan olarak bir sorguda en fazla 1000 satır döner.
// aylik_satislar gibi 1000'i aşan tablolarda .select("*") sessizce veri keser
// (hata vermez!) — bu yardımcı, tüm satırları .range() ile sayfalayarak çeker.
import type { PostgrestResponse } from "@supabase/supabase-js";

export async function tumSatirlariGetir<T>(
  sorgu: (from: number, to: number) => PromiseLike<PostgrestResponse<T>>,
  sayfaBoyutu = 1000,
): Promise<T[]> {
  const sonuc: T[] = [];
  let sayfa = 0;

  for (;;) {
    const from = sayfa * sayfaBoyutu;
    const to = from + sayfaBoyutu - 1;
    const { data, error } = await sorgu(from, to);
    if (error) throw new Error(error.message);
    if (!data || !data.length) break;

    sonuc.push(...data);
    if (data.length < sayfaBoyutu) break;
    sayfa++;
  }

  return sonuc;
}

/**
 * Sorguyu çalıştırır, hata olursa fırlatmak yerine sonuçla birlikte döner.
 *
 * Neden var: bir modülün tablosu henüz oluşturulmamışsa ekranın tamamı
 * kaybolmasın, yalnızca ilgili kart uyarı göstersin istiyoruz. Bunu daha
 * önce `let tabloYok = false` deyip catch içinde değiştirerek yapıyorduk;
 * React'in "render tamamlandıktan sonra değişken yeniden atanamaz" kuralı
 * bunu haklı olarak hata sayıyor. Artık bayrak mutasyonla değil, dönen
 * sonuçtan türetiliyor.
 */
export async function sonuclaGetir<T>(
  islem: () => Promise<T[]>,
): Promise<{ veri: T[]; hata: string | null }> {
  try {
    return { veri: await islem(), hata: null };
  } catch (e) {
    return { veri: [], hata: e instanceof Error ? e.message : String(e) };
  }
}
