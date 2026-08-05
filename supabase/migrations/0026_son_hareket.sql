-- 0026_son_hareket.sql
-- "Son giriş" yanıltıyordu; gerçek kullanım için "son hareket" tutuluyor.
--
-- ── Belirti ──────────────────────────────────────────────────────────────
-- Nezif: "Bazı kullanıcılar günlerdir kullandığı halde programı
-- kullanmıyormuş gibi bir görüntü çıkıyor."
--
-- Kullanıcılar ekranı Supabase'in last_sign_in_at değerini gösteriyordu.
-- O değer YALNIZCA şifreyle giriş yapıldığında güncelleniyor. Oturum açık
-- kaldığı sürece (jeton sessizce yenilenir) kullanıcı haftalarca çalışsa
-- bile tarih değişmiyor.
--
-- 2026-08-05'teki canlı durum bunu açıkça gösteriyordu:
--   İzzet Altuğ  → son giriş 30 Temmuz, ama aynı gün sistemi kullanıyordu
--   muhasebe@    → son giriş 31 Temmuz, aynı sabah etkindi
--
-- ── Çözüm ────────────────────────────────────────────────────────────────
-- profiles.son_hareket: kullanıcı her sayfa açtığında (en fazla birkaç
-- dakikada bir) güncellenen zaman damgası.
--
-- ── Neden politika değil de fonksiyon ────────────────────────────────────
-- Kullanıcının kendi profil satırını güncellemesine izin veren bir RLS
-- politikası yazmak EN KOLAYI olurdu ama RLS sütun seçemez: aynı politika
-- kişinin kendi ROLÜNÜ ve YETKİ KAPSAMINI değiştirmesine de izin verirdi.
--
-- Bunun yerine security definer bir fonksiyon var; yalnızca son_hareket
-- sütununa, yalnızca çağıranın kendi satırında dokunuyor. Başka hiçbir
-- alan bu yoldan değiştirilemez.

alter table public.profiles
  add column if not exists son_hareket timestamptz;

comment on column public.profiles.son_hareket is
  'Kullanıcının panelde en son işlem yaptığı an. last_sign_in_at ile karıştırmayın: o yalnızca şifreyle girişte değişir (bkz. 0026).';

create index if not exists profiles_son_hareket_idx
  on public.profiles (son_hareket desc nulls last);

-- ─── Hareket damgası ─────────────────────────────────────────────────────
create or replace function public.hareket_kaydet()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set son_hareket = now()
   where id = auth.uid();
$$;

comment on function public.hareket_kaydet() is
  'Çağıranın son_hareket damgasını günceller. Yalnızca bu sütuna dokunur; kullanıcı kendi rolünü/kapsamını bu yoldan değiştiremez.';

revoke all on function public.hareket_kaydet() from public, anon;
grant execute on function public.hareket_kaydet() to authenticated;

-- ─── Geçmişe dönük başlangıç ─────────────────────────────────────────────
-- Sütun boş kalırsa herkes "hiç kullanmamış" görünürdü. Bilinen en son
-- giriş anı başlangıç değeri yapılıyor; buradan sonrası gerçek harekete
-- göre ilerleyecek.
update public.profiles p
   set son_hareket = u.last_sign_in_at
  from auth.users u
 where u.id = p.id
   and p.son_hareket is null
   and u.last_sign_in_at is not null;
