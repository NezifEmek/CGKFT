// trello.ts — Trello okuma istemcisi (SADECE sunucu tarafı).
//
// Token yalnızca "read" kapsamıyla üretildi: panel Trello'da hiçbir şeyi
// değiştiremez. Anahtar/token asla istemciye gönderilmez; bütün istekler
// server component / server action içinden yapılır.
//
// Trello hiyerarşisi: Çalışma Alanı (organization) → Pano (board)
//   → Liste (list) → Kart (card).

const TABAN = "https://api.trello.com/1";

/** Nezif'in özellikle görmek istediği panolar — listede en üste sabitlenir. */
export const ONCELIKLI_PANOLAR = [
  "franchise ziyaretleri",
  "franchise talepleri",
  "şikayetler/talepler",
  "rakip analiz",
];

export interface TrelloCalismaAlani {
  id: string;
  displayName: string;
}

export interface TrelloPano {
  id: string;
  name: string;
  url: string;
  shortLink: string;
  idOrganization: string | null;
  dateLastActivity: string | null;
  prefsArkaplanRenk: string | null;
}

export interface TrelloEtiket {
  id: string;
  name: string;
  color: string | null;
}

export interface TrelloKart {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  idList: string;
  idMembers: string[];
  labels: TrelloEtiket[];
  shortUrl: string;
  dateLastActivity: string | null;
  badges?: { comments?: number; attachments?: number; checkItems?: number; checkItemsChecked?: number };
}

export interface TrelloListe {
  id: string;
  name: string;
  closed: boolean;
}

export interface TrelloUye {
  id: string;
  fullName: string;
  initials: string;
}

export interface TrelloPanoDetay {
  id: string;
  name: string;
  url: string;
  desc: string;
  listeler: TrelloListe[];
  kartlar: TrelloKart[];
  uyeler: TrelloUye[];
}

export function trelloYapilandirildiMi(): boolean {
  return Boolean(process.env.TRELLO_API_KEY && process.env.TRELLO_TOKEN);
}

export class TrelloHatasi extends Error {
  constructor(
    message: string,
    readonly durum?: number,
  ) {
    super(message);
    this.name = "TrelloHatasi";
  }
}

/**
 * Trello'ya GET atar. Kimlik bilgileri sorgu dizesine eklenir (Trello'nun
 * beklediği biçim) ama URL asla istemciye ya da log'a çıkmaz.
 */
async function trelloGet<T>(
  yol: string,
  parametreler: Record<string, string> = {},
  saniyeCache = 300,
): Promise<T> {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    throw new TrelloHatasi("Trello API anahtarı veya token tanımlı değil.");
  }

  const url = new URL(TABAN + yol);
  for (const [k, v] of Object.entries(parametreler)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);

  let yanit: Response;
  try {
    yanit = await fetch(url, { next: { revalidate: saniyeCache } });
  } catch {
    throw new TrelloHatasi("Trello'ya bağlanılamadı (ağ hatası).");
  }

  if (yanit.status === 401) {
    throw new TrelloHatasi(
      "Trello token'ı geçersiz veya süresi dolmuş. Yeniden yetkilendirme gerekiyor.",
      401,
    );
  }
  if (yanit.status === 429) {
    throw new TrelloHatasi("Trello istek sınırına takıldı, birazdan tekrar deneyin.", 429);
  }
  if (!yanit.ok) {
    // Hata gövdesini olduğu gibi yansıtmıyoruz; içinde URL (dolayısıyla token) olabilir.
    throw new TrelloHatasi(`Trello isteği başarısız (HTTP ${yanit.status}).`, yanit.status);
  }

  return (await yanit.json()) as T;
}

/** Token'ın eriştiği bütün çalışma alanları. */
export async function calismaAlanlari(): Promise<TrelloCalismaAlani[]> {
  return trelloGet<TrelloCalismaAlani[]>("/members/me/organizations", {
    fields: "displayName",
  });
}

/** Token'ın eriştiği bütün açık panolar. */
export async function panolar(): Promise<TrelloPano[]> {
  const ham = await trelloGet<
    (Omit<TrelloPano, "prefsArkaplanRenk"> & { prefs?: { backgroundColor?: string | null } })[]
  >("/members/me/boards", {
    filter: "open",
    fields: "name,url,shortLink,idOrganization,dateLastActivity,prefs",
  });
  return ham.map((p) => ({
    id: p.id,
    name: p.name,
    url: p.url,
    shortLink: p.shortLink,
    idOrganization: p.idOrganization ?? null,
    dateLastActivity: p.dateLastActivity ?? null,
    prefsArkaplanRenk: p.prefs?.backgroundColor ?? null,
  }));
}

/** Bir panonun listeleri + açık kartları + üyeleri, tek istekte. */
export async function panoDetay(panoId: string): Promise<TrelloPanoDetay> {
  const d = await trelloGet<{
    id: string;
    name: string;
    url: string;
    desc: string;
    lists: TrelloListe[];
    cards: TrelloKart[];
    members: TrelloUye[];
  }>(`/boards/${panoId}`, {
    fields: "name,url,desc",
    lists: "open",
    list_fields: "name,closed",
    cards: "open",
    card_fields:
      "name,desc,due,dueComplete,idList,idMembers,labels,shortUrl,dateLastActivity,badges",
    members: "all",
    member_fields: "fullName,initials",
  });

  return {
    id: d.id,
    name: d.name,
    url: d.url,
    desc: d.desc ?? "",
    listeler: d.lists ?? [],
    kartlar: d.cards ?? [],
    uyeler: d.members ?? [],
  };
}

/** Öncelikli panolar önce, sonra ada göre; çalışma alanı bazlı gruplama için. */
export function panolariSirala(liste: TrelloPano[]): TrelloPano[] {
  const oncelik = (ad: string) => {
    const i = ONCELIKLI_PANOLAR.indexOf(ad.trim().toLocaleLowerCase("tr"));
    return i < 0 ? 99 : i;
  };
  return [...liste].sort((a, b) => {
    const fark = oncelik(a.name) - oncelik(b.name);
    return fark !== 0 ? fark : a.name.localeCompare(b.name, "tr");
  });
}

export function oncelikliMi(ad: string): boolean {
  return ONCELIKLI_PANOLAR.includes(ad.trim().toLocaleLowerCase("tr"));
}

/** Trello etiket renklerini panelde kullanılacak hex karşılıklarına çevirir. */
export const ETIKET_RENK: Record<string, string> = {
  green: "#4bce97",
  yellow: "#f5cd47",
  orange: "#fea362",
  red: "#f87168",
  purple: "#9f8fef",
  blue: "#579dff",
  sky: "#6cc3e0",
  lime: "#94c748",
  pink: "#e774bb",
  black: "#8590a2",
  green_dark: "#1f845a",
  yellow_dark: "#946f00",
  orange_dark: "#c25100",
  red_dark: "#c9372c",
  purple_dark: "#6e5dc6",
  blue_dark: "#0c66e4",
};

export function etiketRengi(color: string | null): string {
  return (color && ETIKET_RENK[color]) || "#8590a2";
}
