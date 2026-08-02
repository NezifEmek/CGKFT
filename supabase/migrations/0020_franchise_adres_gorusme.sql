-- 0020_franchise_adres_gorusme.sql
-- Franchise başvurusuna adres/konum alanları ve çoklu görüşme kaydı.
--
-- Talepler (Nezif):
--   2) "Franchise başvuru formuna da adres ve konum ekleme alanı olsun."
--   7) "Adaylar birden çok kez görüşme olabiliyor. Buna imkan vermiyorsan
--       görüşme ekle gibi bir özellik ekler misin."
--
-- Bugün tek bir `gorusme_notu` metin alanı var; ikinci görüşme yazılınca
-- birincinin üstüne yazılıyor ya da aynı kutuya sıkıştırılıyor. Görüşmeler
-- ayrı satırlara alınıyor — şube sorumlu geçmişi ve şikayet hareketleriyle
-- aynı desen: tarihli, kim yaptı belli, eskisi silinmiyor.

-- ─── Adres ve konum ──────────────────────────────────────────────────────
alter table public.franchise_basvurulari add column if not exists adres      text not null default '';
alter table public.franchise_basvurulari add column if not exists harita_url text not null default '';
alter table public.franchise_basvurulari add column if not exists enlem      numeric(10,7);
alter table public.franchise_basvurulari add column if not exists boylam     numeric(10,7);

comment on column public.franchise_basvurulari.harita_url is
  'Google Maps bağlantısı. Koordinat bağlantının içinden okunur (bkz. src/lib/konum.ts).';

-- ─── Görüşmeler ──────────────────────────────────────────────────────────
create table if not exists public.franchise_gorusmeleri (
  id           uuid primary key default gen_random_uuid(),
  basvuru_id   uuid not null references public.franchise_basvurulari(id) on delete cascade,
  tarih        date not null default current_date,
  tur          text not null default 'telefon'
                 check (tur in ('telefon', 'yuz_yuze', 'video', 'saha_ziyareti', 'diger')),
  gorusen      text not null default '',        -- görüşmeyi yapan kişi
  notlar       text not null default '',
  sonraki_adim text not null default '',        -- "2 hafta sonra tekrar aranacak"
  sonraki_tarih date,
  olusturan_id uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

comment on table public.franchise_gorusmeleri is
  'Bir başvuruyla yapılan görüşmelerin tamamı. Tek notluk alan yerine tarihli kayıtlar.';

create index if not exists franchise_gorusme_basvuru
  on public.franchise_gorusmeleri (basvuru_id, tarih desc);
create index if not exists franchise_gorusme_sonraki
  on public.franchise_gorusmeleri (sonraki_tarih)
  where sonraki_tarih is not null;

alter table public.franchise_gorusmeleri enable row level security;

drop policy if exists "franchise_gorusme_select" on public.franchise_gorusmeleri;
create policy "franchise_gorusme_select" on public.franchise_gorusmeleri
  for select using (auth.uid() is not null);

drop policy if exists "franchise_gorusme_ekle" on public.franchise_gorusmeleri;
create policy "franchise_gorusme_ekle" on public.franchise_gorusmeleri
  for insert with check (public.auth_rol() <> 'denetmen');

drop policy if exists "franchise_gorusme_guncelle" on public.franchise_gorusmeleri;
create policy "franchise_gorusme_guncelle" on public.franchise_gorusmeleri
  for update using (olusturan_id = auth.uid() or public.auth_rol() in ('admin', 'genel_mudur'))
  with check (olusturan_id = auth.uid() or public.auth_rol() in ('admin', 'genel_mudur'));

-- Silme yalnızca yönetimde: görüşme geçmişi tutanak niteliğinde.
drop policy if exists "franchise_gorusme_sil" on public.franchise_gorusmeleri;
create policy "franchise_gorusme_sil" on public.franchise_gorusmeleri
  for delete using (public.auth_rol() in ('admin', 'genel_mudur'));

-- ─── Var olan tek notu ilk görüşme olarak taşı ───────────────────────────
-- Dolu olan gorusme_notu alanları kaybolmasın; ilk görüşme kaydına dönüşsün.
-- Tarih olarak sorumlunun arama tarihi, o da yoksa başvuru tarihi.
insert into public.franchise_gorusmeleri (basvuru_id, tarih, tur, gorusen, notlar)
select b.id,
       coalesce(b.sorumlu_arama_tarihi, b.tarih),
       'telefon',
       coalesce(b.sirket_sorumlusu, ''),
       b.gorusme_notu
  from public.franchise_basvurulari b
 where trim(coalesce(b.gorusme_notu, '')) <> ''
   and not exists (
     select 1 from public.franchise_gorusmeleri g where g.basvuru_id = b.id
   );
