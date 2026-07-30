-- 0003_merkez_gg.sql
-- Merkez Şube Gelir-Gider defteri.
--
-- Eski panelde bu veri yalnızca çok sayfalı bir Excel sihirbazından gelirdi ve
-- her içe aktarma ilgili şube+ay bloğunun TAMAMINI silip yeniden yazardı.
-- Nezif hem Excel hem elle giriş istediği için burada defter ana kaynak:
-- iki yol da aynı tabloya yazar, içe aktarma gün bazında upsert yapar, yani
-- Excel'de olmayan bir güne elle girilen kayıt silinmez.
--
-- Eski yapıda ay yalnızca ad olarak tutuluyordu (yıl yok) — iki yılın aynı ayı
-- çakışırdı. Burada günlük tabloda gerçek tarih, kalem tablosunda yıl + ay var.

-- ─── Günlük gelir-gider ──────────────────────────────────────────────────
-- Gelir bileşenleri: nakit, kredi kartı, ticket, yemek sepeti, ayran
-- Gider bileşenleri: yemek (personel yemeği), genel masraf
create table if not exists public.merkez_gg_gunluk (
  id uuid primary key default gen_random_uuid(),
  sube_id uuid not null references public.subeler(id) on delete cascade,
  tarih date not null,
  nakit numeric not null default 0,
  kredi_karti numeric not null default 0,
  ticket numeric not null default 0,
  yemek_sepeti numeric not null default 0,
  ayran numeric not null default 0,
  yemek numeric not null default 0,
  genel_masraf numeric not null default 0,
  kaynak text not null default 'elle' check (kaynak in ('elle', 'excel')),
  guncelleyen_id uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (sube_id, tarih)
);

create index if not exists merkez_gg_gunluk_sube_tarih
  on public.merkez_gg_gunluk (sube_id, tarih);

-- ─── Aylık stok/gider kalemleri ──────────────────────────────────────────
-- Tamamı gider sayılır (eski merkezGGSubeAylik ile aynı).
create table if not exists public.merkez_gg_kalem (
  id uuid primary key default gen_random_uuid(),
  sube_id uuid not null references public.subeler(id) on delete cascade,
  yil smallint not null,
  ay text not null,
  urun text not null,
  adet numeric not null default 0,
  tutar numeric not null default 0,
  kaynak text not null default 'elle' check (kaynak in ('elle', 'excel')),
  guncelleyen_id uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create index if not exists merkez_gg_kalem_sube_donem
  on public.merkez_gg_kalem (sube_id, yil, ay);

alter table public.merkez_gg_gunluk enable row level security;
alter table public.merkez_gg_kalem enable row level security;

-- ─── Politikalar ─────────────────────────────────────────────────────────
-- Okuma: şubeye erişimi olan herkes. Yazma: aylik_satislar ile aynı kural —
-- admin/genel müdür her şube, bölge müdürü kendi bölgesi, denetmen yazamaz.

create policy "merkez_gg_gunluk_select" on public.merkez_gg_gunluk
  for select using (
    exists (
      select 1 from public.subeler s
      where s.id = merkez_gg_gunluk.sube_id
        and public.sube_erisilebilir(s.id, s.bolge)
    )
  );

create policy "merkez_gg_gunluk_yaz" on public.merkez_gg_gunluk
  for all using (
    exists (
      select 1 from public.subeler s
      where s.id = merkez_gg_gunluk.sube_id and public.sube_duzenlenebilir(s.bolge)
    )
  )
  with check (
    exists (
      select 1 from public.subeler s
      where s.id = merkez_gg_gunluk.sube_id and public.sube_duzenlenebilir(s.bolge)
    )
  );

create policy "merkez_gg_kalem_select" on public.merkez_gg_kalem
  for select using (
    exists (
      select 1 from public.subeler s
      where s.id = merkez_gg_kalem.sube_id
        and public.sube_erisilebilir(s.id, s.bolge)
    )
  );

create policy "merkez_gg_kalem_yaz" on public.merkez_gg_kalem
  for all using (
    exists (
      select 1 from public.subeler s
      where s.id = merkez_gg_kalem.sube_id and public.sube_duzenlenebilir(s.bolge)
    )
  )
  with check (
    exists (
      select 1 from public.subeler s
      where s.id = merkez_gg_kalem.sube_id and public.sube_duzenlenebilir(s.bolge)
    )
  );
