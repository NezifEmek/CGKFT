-- 0025_yeni_sube_ekleme.sql
-- Merkez yetkilileri yeni şube ekleyemiyordu.
--
-- ── Belirti ──────────────────────────────────────────────────────────────
-- 2026-08-04: "Yeni şube tanımlamasında da sorun var. Yeni şube
-- ekleyemiyorlar."
--
-- ── Sebep ────────────────────────────────────────────────────────────────
-- subeler INSERT politikası `sube_duzenlenebilir(bolge)` çağırıyor. Kapsamı
-- "yetkili" olan kullanıcılar için o fonksiyon şunu soruyor:
--
--   "Bu BÖLGEDE, merkez yetkilisi BEN olan bir şube ZATEN VAR MI?"
--
-- Yani yeni şube açma izni, o bölgede önceden şubesi olmasına bağlıydı.
-- Tavuk-yumurta: bir bölgedeki İLK şubesini kimse açamıyordu.
--
-- Canlı durum (2026-08-04):
--   Umut Can Doğan → 6 bölgeden 6'sına ekleyebiliyor
--   İzzet Altuğ    → 5'ine (İSTANBUL'a EKLEYEMİYOR)
--   Metin Başok    → 5'ine (GEBZE'ye EKLEYEMİYOR)
--
-- Temmuz satış dosyasındaki yeni şubeler KONYA, MUĞLA, BALIKESİR gibi
-- illerdeydi; bunlar bölge atamasına göre kilitli bölgelere düşünce
-- ekleme reddediliyordu.
--
-- ── Çözüm ────────────────────────────────────────────────────────────────
-- INSERT'e ikinci bir yol ekleniyor: kişi, MERKEZ YETKİLİSİ KENDİSİ olan
-- bir şubeyi, o bölgede henüz şubesi olmasa da açabilir. Doğal kural bu —
-- "sorumluluğunu üstlendiğim şubeyi açabilirim".
--
-- Mevcut yol (sube_duzenlenebilir) olduğu gibi duruyor; kimse yetki
-- kaybetmiyor, yalnızca tıkanan durum açılıyor.
--
-- GÜNCELLEME politikası bilerek DEĞİŞTİRİLMEDİ: var olan bir şubeyi
-- düzenlemek başka bir şey, o hâlâ kapsam kurallarına bağlı.
--
-- ── Not: yazabilir bayrağı ───────────────────────────────────────────────
-- Bu migration'ın ÇÖZMEDİĞİ ayrı bir durum var. Ümran Balcı, Gamze Dağ,
-- Hüseyin Akı ve Tuğçe Mollaoğlu profillerinde `yazabilir = false`.
-- O bayrak kapalıyken kişi hiçbir şubeyi ekleyemez/düzenleyemez — kapsamı
-- "tüm şubeler" olsa bile. Bu bir AYAR, hata değil; değiştirilmesi
-- gerekiyorsa Kullanıcılar ekranından açılmalı. Kod bunu kendiliğinden
-- değiştirmiyor: kimin yazma yetkisi olacağı yönetimin kararı.

drop policy if exists "subeler_insert" on public.subeler;
create policy "subeler_insert" on public.subeler
  for insert with check (
    public.sube_duzenlenebilir(bolge)
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.yazabilir
        and p.kapsam_turu = 'yetkili'
        and coalesce(nullif(btrim(p.kapsam_yetkilisi), ''), '') <> ''
        -- Yeni satırın merkez yetkilisi kendisi olmalı. Türkçe 'i'
        -- sorununa girmemek için upper() yerine karşılaştırma her iki
        -- tarafta da aynı işlevle yapılıyor.
        and upper(btrim(coalesce(p.kapsam_yetkilisi, ''))) =
            upper(btrim(coalesce(subeler.merkez_yetkilisi, '')))
    )
  );

comment on policy "subeler_insert" on public.subeler is
  'Kapsamı "yetkili" olan kullanıcı, merkez yetkilisi kendisi olan yeni şubeyi o bölgede henüz şubesi olmasa da açabilir (bkz. 0025).';
