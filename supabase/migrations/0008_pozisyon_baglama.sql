-- 0008_pozisyon_baglama.sql
-- Panel kullanıcısını organizasyondaki pozisyona bağlar.
--
-- Amaç: admin olmayan kullanıcı kendi KPI'ını, primini ve görev tanımını
-- görsün — astlarınınkini de görsün, başkasınınkini görmesin.
--
-- Hiyerarşi AYRICA tanımlanmıyor: organizasyon şeması zaten görev
-- tanımlarındaki "Bağlı Olduğu Kişi" alanından türetiliyor, "astları" da o
-- ağacın alt dalları. Şema değiştikçe görünürlük kendiliğinden değişir.
--
-- Genel müdür ağacın kökü olduğu için astları herkestir; yani aynı kural
-- üst kademede "hepsini gör" anlamına gelir, ayrı istisna gerekmiyor.

alter table public.profiles
  add column if not exists pozisyon_id text;

comment on column public.profiles.pozisyon_id is
  'dokuman_ayarlari.pozisyonlar içindeki pozisyon id''si (p01, p02 …). Boşsa kullanıcı kişisel kayıtları (prim, görev tanımı, KPI) göremez.';
