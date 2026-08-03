-- 0023_sikayet_kayit_acma_duzeltmesi.sql
-- Yönetim dışındaki roller şikayet kaydı AÇAMIYORDU.
--
-- ── Belirti ──────────────────────────────────────────────────────────────
-- 2026-08-03: Bölge müdürü Ümran Balcı bir müşteri şikayetini kaydedemedi;
-- aynı şikayeti admin olan Nezif sorunsuz kaydetti. Veritabanında
-- ŞKY-1005'ten sonra ŞKY-1007 vardı — ŞKY-1006 numarası ÜRETİLMİŞ ama
-- satır yoktu. Sıra numaraları geri alınmadığı için bu, işlemin
-- başlatılıp GERİ ALINDIĞININ kanıtı.
--
-- ── Sebep ────────────────────────────────────────────────────────────────
-- Uygulama kaydı `insert ... returning id` ile yazıyor. PostgreSQL,
-- RETURNING ile satır geri verirken SELECT politikasını da uygular.
-- SELECT politikası `sikayet_gorunur(id)` fonksiyonunu çağırıyor; o
-- fonksiyon "bu kaydı ben mi açtım" sorusunu SİKAYETLER TABLOSUNU
-- SORGULAYARAK cevaplıyordu:
--
--     exists (select 1 from public.sikayetler s
--             where s.id = hedef_id and s.olusturan_id = auth.uid())
--
-- Fonksiyon STABLE olduğu için INSERT komutunun anlık görüntüsünü
-- kullanıyor; o görüntüde henüz yazılmamış satır YOKTUR. Dolayısıyla
-- "kendi açtığı kayıt" kuralı her zaman false dönüyordu.
--
-- Admin/genel müdürde sorun çıkmamasının sebebi, onların
-- "yönetim her şeyi görür" dalına düşmesi ve o dalın tabloya hiç
-- bakmaması. Bölge müdürü, denetmen, çağrı merkezi, franchise… hepsi
-- tabloyu sorgulayan dallara düştüğü için kayıt açamıyordu.
--
-- ── Çözüm ────────────────────────────────────────────────────────────────
-- "Kendi açtığı kayıt" kuralı artık SATIRIN KENDİ SÜTUNUNDAN okunuyor:
-- politikada doğrudan `olusturan_id = auth.uid()`. Bu, tabloya sorgu
-- yapmadığı için INSERT sırasında da doğru çalışır.
--
-- Fonksiyon olduğu gibi duruyor; sonradan yapılan okumalarda (liste,
-- kart, geçmiş) davranış değişmiyor. Politikaya yalnızca tabloya
-- bakmayan bir ön koşul eklendi.

drop policy if exists "sikayet_select" on public.sikayetler;
create policy "sikayet_select" on public.sikayetler
  for select using (
    -- Sıra önemli: bu koşul tabloya sorgu YAPMAZ, satırın kendi
    -- sütununu okur. INSERT ... RETURNING sırasında çalışan tek kural bu.
    olusturan_id = auth.uid()
    or public.sikayet_gorunur(id)
  );

-- Güncelleme politikası da aynı sorunu taşıyor: kişi kendi açtığı kaydı
-- düzenlerken UPDATE ... RETURNING kullanılırsa aynı yere düşer.
drop policy if exists "sikayet_update" on public.sikayetler;
create policy "sikayet_update" on public.sikayetler
  for update using (
    olusturan_id = auth.uid()
    or public.sikayet_gorunur(id)
  )
  with check (
    olusturan_id = auth.uid()
    or public.sikayet_gorunur(id)
  );

-- ── Aynı tuzağın diğer tabloları ─────────────────────────────────────────
-- sikayet_hareketleri ve sikayet_atamalari da sikayet_gorunur() kullanıyor
-- ama onlar ŞİKAYETİN kimliğine bakıyor; o satır çoktan yazılmış ve
-- görünür oluyor. Bu yüzden onlara dokunulmuyor.
--
-- Kayıt oluşturulurken hareket satırını yazan trigger
-- (sikayet_durum_gunlukle) security definer olduğu için RLS'e takılmıyor.

comment on policy "sikayet_select" on public.sikayetler is
  'olusturan_id kontrolü bilerek fonksiyonun DIŞINDA: sikayet_gorunur() tabloyu sorguladığı için INSERT ... RETURNING sırasında yeni satırı göremiyor (bkz. 0023).';
