-- 0018_kadro.sql
-- Personel kadrosu ve pozisyon atama geçmişi.
--
-- Talep (Nezif, 2026-08-02):
--   "Prim sayfası organizasyon şemasından beslenmeli. İsimleri doğrudan oran
--    almalı… görevli değiştikçe eski kayıtlar yok olmamalı. Örneğin Gıda
--    Mühendisi Tuğçe hanım Temmuz sonunda ayrılsa, Ağustos'ta yeni biri
--    başlasa, önceki aylarda gıda mühendisi işi Tuğçe hanım'la bağlantılı
--    kalmalı… güncel personel listesi olmalı… güncellenmesi için elle
--    müdahale gereken yerler için uyarı olmalı."
--
-- ── Bugünkü sorun ─────────────────────────────────────────────────────
-- Adlar İKİ ayrı yerde tutuluyor: dokuman_ayarlari.pozisyonlar[].adSoyad
-- ve prim_ayarlari.personel_uretim/personel_merkez. İkisi çoktan ayrışmış:
-- prim listesindeki 6 kişinin (Hossam, Muhammed, Ahmet, Bayram, Cemil,
-- Elif) görev tanımı yok; üç pozisyonun ad alanına birden fazla kişi
-- sıkıştırılmış ("Hossam ALRAJAB / Muhammed ABDULLAH (Vardiya Ekibi)").
--
-- Dahası prim hiçbir yere KAYDEDİLMİYOR; her açılışta güncel listeden
-- yeniden hesaplanıyor. Yani biri ayrılıp yerine yenisi girildiğinde
-- geçmiş ayların primi de yeni kişiye yazılıyordu.
--
-- ── Çözüm ─────────────────────────────────────────────────────────────
-- Tek kadro listesi + tarihli pozisyon atamaları. Prim, seçilen AYDA
-- görevde olan kişilerden hesaplanıyor; geçmiş ay geçmişteki kadroyu
-- göstermeye devam ediyor. Şube sorumlu geçmişiyle (0010) aynı desen.

-- ─── Kadro ───────────────────────────────────────────────────────────────
create table if not exists public.personeller (
  id          uuid primary key default gen_random_uuid(),
  ad_soyad    text not null,
  telefon     text not null default '',
  eposta      text not null default '',
  ise_giris   date,
  ayrilis     date,
  -- Panele girişi olan kişiler için bağlantı. Üretim personelinin çoğunun
  -- hesabı yok; bu yüzden kadro listesi profiles'tan AYRI duruyor.
  profil_id   uuid references public.profiles(id) on delete set null,
  notlar      text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint personel_tarih_sirasi check (ayrilis is null or ise_giris is null or ayrilis >= ise_giris)
);

comment on table public.personeller is
  'Şirket kadrosu. Panel hesabı olmayan üretim/sevkiyat personeli de burada.';
comment on column public.personeller.ayrilis is
  'Ayrılış tarihi. Dolu ise kişi pasiftir ama kayıtları ve geçmiş primi silinmez.';

create index if not exists personel_ad on public.personeller (ad_soyad);

-- ─── Pozisyon atamaları ──────────────────────────────────────────────────
-- pozisyon_id: dokuman_ayarlari.pozisyonlar dizisindeki görev tanımının id'si.
-- Görev tanımları JSON'da durduğu için yabancı anahtar kurulamıyor; bağ
-- uygulama tarafında doğrulanıyor ve "karşılığı olmayan atama" uyarı üretiyor.
--
-- Dönem [baslangic, bitis); bitis null = hâlen görevde.
-- Bir pozisyonda AYNI ANDA birden fazla kişi olabilir (Üretim Personeli 2
-- kişi), o yüzden pozisyon başına tek açık kayıt kısıtı YOK.
create table if not exists public.pozisyon_atamalari (
  id           uuid primary key default gen_random_uuid(),
  pozisyon_id  text not null,
  personel_id  uuid not null references public.personeller(id) on delete cascade,
  baslangic    date,
  bitis        date,
  -- Primin hangi havuzdan hesaplanacağı. Görev tanımından değil atamadan
  -- geliyor: aynı unvan farklı dönemde farklı havuza girebilir.
  prim_grubu   text not null default 'yok'
                 check (prim_grubu in ('yok', 'uretim', 'merkez',
                                       'merkez_sorumlu', 'bolge1', 'bolge2')),
  aciklama     text not null default '',
  created_at   timestamptz not null default now(),
  constraint atama_tarih_sirasi check (bitis is null or baslangic is null or bitis >= baslangic)
);

comment on table public.pozisyon_atamalari is
  'Kimin hangi görev tanımında, hangi dönemde bulunduğu. Prim seçilen ayda görevde olanlardan hesaplanır.';

create index if not exists atama_pozisyon on public.pozisyon_atamalari (pozisyon_id, baslangic desc);
create index if not exists atama_personel on public.pozisyon_atamalari (personel_id, baslangic desc);

-- Aynı kişi aynı pozisyonda iki kez "hâlen görevde" olamaz.
create unique index if not exists atama_tek_acik
  on public.pozisyon_atamalari (pozisyon_id, personel_id)
  where bitis is null;

-- ─── Ayrılış kadroyu kapatsın ────────────────────────────────────────────
-- Kişiye ayrılış tarihi girilince açık atamaları o tarihte biter. Elle
-- kapatmayı unutmak, ayrılan kişinin primde görünmeye devam etmesi demek.
create or replace function public.personel_ayrilis_kapat()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.ayrilis is not null and (old.ayrilis is null or old.ayrilis <> new.ayrilis) then
    update public.pozisyon_atamalari
       set bitis = new.ayrilis
     where personel_id = new.id and bitis is null;
  end if;
  -- Ayrılış geri alınırsa (yanlış girilmişse) atamalar açılmaz; hangi
  -- pozisyona döndüğü belirsiz olduğu için bu elle yapılmalı.
  return new;
end
$$;

drop trigger if exists personel_ayrilis_trg on public.personeller;
create trigger personel_ayrilis_trg
  after update of ayrilis on public.personeller
  for each row execute function public.personel_ayrilis_kapat();

-- ─── Belirli bir ayda görevde olanlar ────────────────────────────────────
-- Ay başı ve ay sonu arasında en az bir gün görevde olan atamalar.
create or replace function public.ayda_gorevliler(hedef_ay date)
returns table (
  atama_id     uuid,
  pozisyon_id  text,
  personel_id  uuid,
  ad_soyad     text,
  prim_grubu   text
)
language sql stable security definer set search_path = public
as $$
  select a.id, a.pozisyon_id, a.personel_id, p.ad_soyad, a.prim_grubu
    from public.pozisyon_atamalari a
    join public.personeller p on p.id = a.personel_id
   where (a.baslangic is null or a.baslangic <= (date_trunc('month', hedef_ay) + interval '1 month - 1 day')::date)
     and (a.bitis is null or a.bitis >= date_trunc('month', hedef_ay)::date)
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────
-- Kadro şirket geneli bilgi: giriş yapan herkes görür, yönetim düzenler.
alter table public.personeller enable row level security;
alter table public.pozisyon_atamalari enable row level security;

drop policy if exists "personel_select" on public.personeller;
create policy "personel_select" on public.personeller
  for select using (auth.uid() is not null);
drop policy if exists "personel_yonet" on public.personeller;
create policy "personel_yonet" on public.personeller
  for all using (public.auth_rol() in ('admin', 'genel_mudur'))
  with check (public.auth_rol() in ('admin', 'genel_mudur'));

drop policy if exists "atama_select" on public.pozisyon_atamalari;
create policy "atama_select" on public.pozisyon_atamalari
  for select using (auth.uid() is not null);
drop policy if exists "atama_yonet" on public.pozisyon_atamalari;
create policy "atama_yonet" on public.pozisyon_atamalari
  for all using (public.auth_rol() in ('admin', 'genel_mudur'))
  with check (public.auth_rol() in ('admin', 'genel_mudur'));
