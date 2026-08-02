-- 0015_dosyalar.sql
-- Dosya ekleri (Supabase Storage) ve franchise sözleşme takibi.
--
-- Talepler:
--   KONULAR2 / Şikayet md.1: "Dosya ve görsel ekleme"
--   KONULAR   md.4: franchise sözleşme dosyaları + süre takibi
--
-- ── Kova (bucket) ─────────────────────────────────────────────────────
-- ÖZEL (private) kova. Sözleşmeler ve şikayet ekleri kurumsal belge;
-- herkese açık bir bağlantıyla internete düşmemeli. Dosyalar imzalı,
-- süreli bağlantılarla sunulur.
insert into storage.buckets (id, name, public, file_size_limit)
values ('belgeler', 'belgeler', false, 26214400)   -- 25 MB
on conflict (id) do update set public = false, file_size_limit = 26214400;

-- Storage erişimi: yükleme/okuma/silme yalnızca giriş yapmış kullanıcılar.
-- Kayıt bazlı ayrıntılı yetki uygulama tarafında (imzalı bağlantı üretilirken)
-- kontrol ediliyor; kovaya doğrudan erişim zaten anonim kullanıcılara kapalı.
drop policy if exists "belgeler_oku" on storage.objects;
create policy "belgeler_oku" on storage.objects
  for select using (bucket_id = 'belgeler' and auth.uid() is not null);

drop policy if exists "belgeler_yukle" on storage.objects;
create policy "belgeler_yukle" on storage.objects
  for insert with check (bucket_id = 'belgeler' and auth.uid() is not null);

drop policy if exists "belgeler_sil" on storage.objects;
create policy "belgeler_sil" on storage.objects
  for delete using (bucket_id = 'belgeler' and auth.uid() is not null);

-- ── Dosya kayıtları ───────────────────────────────────────────────────
-- Storage'daki nesnenin yanında kim, ne zaman, hangi kayda ekledi
-- bilgisini tutar. Tek tablo: her modül için ayrı tablo açmak aynı kodu
-- beş kez yazdırırdı.
create table if not exists public.dosyalar (
  id          uuid primary key default gen_random_uuid(),
  kapsam      text not null check (kapsam in ('sikayet', 'sozlesme', 'sube', 'toplanti', 'franchise')),
  kayit_id    uuid not null,                 -- ilgili kaydın id'si
  yol         text not null unique,          -- storage içindeki yol
  ad          text not null,                 -- kullanıcının gördüğü dosya adı
  boyut       bigint,
  mime        text not null default '',
  aciklama    text not null default '',
  yukleyen_id uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

comment on table public.dosyalar is
  'Storage''daki dosyaların kayıt defteri. kapsam+kayit_id, dosyanın hangi modüldeki hangi kayda ait olduğunu söyler.';
comment on column public.dosyalar.yol is
  'storage.objects içindeki tam yol. Benzersiz — aynı nesne iki kez kaydedilemez.';

create index if not exists dosya_kapsam on public.dosyalar (kapsam, kayit_id, created_at desc);

alter table public.dosyalar enable row level security;

drop policy if exists "dosya_select" on public.dosyalar;
create policy "dosya_select" on public.dosyalar
  for select using (auth.uid() is not null);

drop policy if exists "dosya_ekle" on public.dosyalar;
create policy "dosya_ekle" on public.dosyalar
  for insert with check (auth.uid() = yukleyen_id);

drop policy if exists "dosya_sil" on public.dosyalar;
create policy "dosya_sil" on public.dosyalar
  for delete using (
    yukleyen_id = auth.uid() or public.auth_rol() in ('admin', 'genel_mudur')
  );

-- ── Sözleşmeler ───────────────────────────────────────────────────────
-- "Franchise sözleşme dosyalarının yüklenmesi ve sürelerinin takibi"
create table if not exists public.sozlesmeler (
  id           uuid primary key default gen_random_uuid(),
  sube_id      uuid not null references public.subeler(id) on delete cascade,
  tur          text not null default 'franchise'
                 check (tur in ('franchise', 'kira', 'marka', 'diger')),
  sozlesme_no  text not null default '',
  baslangic    date,
  bitis        date,
  -- Yenileme hatırlatması: bitişten kaç gün önce uyarılsın.
  uyari_gun    integer not null default 90,
  taraf        text not null default '',      -- karşı taraf (kişi/firma)
  notlar       text not null default '',
  olusturan_id uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Bitiş başlangıçtan önce olamaz; tarih hatası süre takibini bozar.
  constraint sozlesme_tarih_sirasi check (bitis is null or baslangic is null or bitis >= baslangic)
);

comment on column public.sozlesmeler.uyari_gun is
  'Bitişe bu kadar gün kalınca "yaklaşıyor" uyarısı verilir. Varsayılan 90.';

create index if not exists sozlesme_sube on public.sozlesmeler (sube_id);
create index if not exists sozlesme_bitis on public.sozlesmeler (bitis);

alter table public.sozlesmeler enable row level security;

drop policy if exists "sozlesme_select" on public.sozlesmeler;
create policy "sozlesme_select" on public.sozlesmeler
  for select using (
    exists (select 1 from public.subeler s
             where s.id = sozlesmeler.sube_id
               and public.sube_erisilebilir(s.id, s.bolge))
  );

drop policy if exists "sozlesme_yonet" on public.sozlesmeler;
create policy "sozlesme_yonet" on public.sozlesmeler
  for all using (
    exists (select 1 from public.subeler s
             where s.id = sozlesmeler.sube_id
               and public.sube_duzenlenebilir(s.bolge))
  )
  with check (
    exists (select 1 from public.subeler s
             where s.id = sozlesmeler.sube_id
               and public.sube_duzenlenebilir(s.bolge))
  );
