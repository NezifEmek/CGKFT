-- 0024_profil_dizini.sql
-- Kişi listeleri herkese açılıyor — görev ataması yapılabilsin.
--
-- ── Belirti ──────────────────────────────────────────────────────────────
-- 2026-08-04: Bölge müdürü Ümran Balcı şikayete görevli atarken açılır
-- listede YALNIZCA KENDİ ADINI görüyordu. Aynı sorun franchise başvurusu,
-- toplantı katılımcıları, haftalık faaliyet gibi kişi listesi kullanan her
-- ekranda vardı.
--
-- ── Sebep ────────────────────────────────────────────────────────────────
-- profiles tablosunda yalnızca iki okuma kuralı vardı:
--     profiles_kendi_kaydi     → id = auth.uid()
--     profiles_admin_tumu_gorur → rol in ('admin','genel_mudur')
-- Yani admin ve genel müdür dışında kimse başkasının adını okuyamıyordu.
--
-- ── Neden politika eklemekle çözülmedi ───────────────────────────────────
-- "Giriş yapan herkes profiles'ı okusun" demek EN KOLAYI olurdu ama
-- profiles satırında rol, sayfa_yetkileri, kapsam_turu, kapsam_yetkilisi
-- gibi YETKİ AYARLARI da duruyor. RLS satır düzeyinde çalışır, sütun
-- seçemez; o politika kimin neye yetkisi olduğunu da herkese açardı.
--
-- Bunun yerine yalnızca ad/rol/pozisyon içeren bir GÖRÜNÜM açılıyor.
-- Görünüm postgres'e ait olduğu için altındaki profiles RLS'ini atlar;
-- açığa çıkan tek şey burada seçilen sütunlar. Yetki ayarları profiles'ta
-- kapalı kalmaya devam ediyor.
--
-- Bu bilgiler zaten gizli değil: Organizasyon Şeması ve Görev Tanımları
-- ekranları adları ve pozisyonları herkese gösteriyor.

create or replace view public.profil_dizini as
  select
    p.id,
    p.ad_soyad,
    p.rol,
    p.pozisyon_id
  from public.profiles p;

comment on view public.profil_dizini is
  'Kişi seçim listeleri için ad dizini. profiles RLS''ini bilerek atlar; yalnızca ad/rol/pozisyon sütunlarını açar, yetki ayarlarını açmaz (bkz. 0024).';

-- anon'a kapalı: giriş yapmamış birinin personel listesini okumasına
-- gerek yok.
revoke all on public.profil_dizini from anon;
grant select on public.profil_dizini to authenticated;
