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
