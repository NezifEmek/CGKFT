-- 0019_silme_koruma.sql
-- Silme yetkilerinin daraltılması ve silinen kaydın günlüğe alınması.
--
-- Talep (Nezif): "Şube silme vb. silme yetkilerine bir kısıtlama koymalıyız.
-- Herkes istediği gibi veri silememeli."
--
-- ── Bugünkü durum incelendi ───────────────────────────────────────────
-- subeler silme zaten admin/genel müdürdeydi. Asıl açık başka yerdeydi:
--
--   aylik_satislar → sube_duzenlenebilir() ile herkes silebiliyordu.
--     Yani yazma yetkisi olan bir bölge müdürü aylık satış kayıtlarını
--     silebiliyordu. Panelin en değerli verisi bu.
--   sozlesmeler   → aynı şekilde.
--
-- Bu ikisi admin/genel müdüre indiriliyor. Denetim ve hızlı skorda kişinin
-- KENDİ kaydını silmesi korunuyor: yanlış girdiği denetimi düzeltebilmeli.
--
-- ── İkinci koruma: silinen kayıt kaybolmuyor ──────────────────────────
-- Yetki daraltmak yetmez; yetkili biri de yanlışlıkla silebilir. Silinen
-- satırın tamamı silme_gunlugu'ne jsonb olarak yazılıyor. Böylece "kim
-- neyi ne zaman sildi" sorusu cevaplanabiliyor ve kayıt geri yazılabiliyor.

create table if not exists public.silme_gunlugu (
  id          uuid primary key default gen_random_uuid(),
  tablo       text not null,
  kayit_id    uuid,
  veri        jsonb not null,
  silen_id    uuid references public.profiles(id),
  silen_ad    text not null default '',
  created_at  timestamptz not null default now()
);

comment on table public.silme_gunlugu is
  'Silinen kayıtların tam kopyası. Yanlışlıkla silinen veri buradan geri yazılabilir.';

create index if not exists silme_gunlugu_tablo on public.silme_gunlugu (tablo, created_at desc);

alter table public.silme_gunlugu enable row level security;

drop policy if exists "silme_gunlugu_select" on public.silme_gunlugu;
create policy "silme_gunlugu_select" on public.silme_gunlugu
  for select using (public.auth_rol() in ('admin', 'genel_mudur'));

-- Günlüğe yalnızca trigger yazar; kimse elle satır ekleyip silemez.
-- (INSERT/UPDATE/DELETE politikası yok = RLS altında yasak.)

create or replace function public.silineni_gunlukle()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ad text;
begin
  select ad_soyad into ad from public.profiles where id = auth.uid();
  insert into public.silme_gunlugu (tablo, kayit_id, veri, silen_id, silen_ad)
  values (TG_TABLE_NAME, old.id, to_jsonb(old), auth.uid(), coalesce(ad, ''));
  return old;
end
$$;

-- En değerli ve en zor geri kazanılan tablolar.
drop trigger if exists subeler_silme_trg on public.subeler;
create trigger subeler_silme_trg
  before delete on public.subeler
  for each row execute function public.silineni_gunlukle();

drop trigger if exists aylik_satislar_silme_trg on public.aylik_satislar;
create trigger aylik_satislar_silme_trg
  before delete on public.aylik_satislar
  for each row execute function public.silineni_gunlukle();

drop trigger if exists denetimler_silme_trg on public.denetimler;
create trigger denetimler_silme_trg
  before delete on public.denetimler
  for each row execute function public.silineni_gunlukle();

drop trigger if exists personel_silme_trg on public.personeller;
create trigger personel_silme_trg
  before delete on public.personeller
  for each row execute function public.silineni_gunlukle();

-- ── Yetki daraltma ────────────────────────────────────────────────────
drop policy if exists "aylik_satislar_sil" on public.aylik_satislar;
create policy "aylik_satislar_sil" on public.aylik_satislar
  for delete using (public.auth_rol() in ('admin', 'genel_mudur'));

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

-- FOR ALL politikası silmeyi de kapsıyor; silmeyi ayrıca daraltmak için
-- kısıtlayıcı (restrictive) bir politika ekleniyor: diğer politikalar ne
-- derse desin, silme yalnızca admin/genel müdürde.
drop policy if exists "sozlesme_sil_kisit" on public.sozlesmeler;
create policy "sozlesme_sil_kisit" on public.sozlesmeler
  as restrictive
  for delete using (public.auth_rol() in ('admin', 'genel_mudur'));

-- Aynı koruma şube silmede de dursun (bugün zaten öyle ama açıkça yazalım).
drop policy if exists "subeler_sil_kisit" on public.subeler;
create policy "subeler_sil_kisit" on public.subeler
  as restrictive
  for delete using (public.auth_rol() in ('admin', 'genel_mudur'));
