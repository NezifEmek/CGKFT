# Çiğköfte Satış Paneli — Faz 1 (Kurumsal Altyapı)

Next.js + Supabase (Postgres + Auth + RLS) tabanlı, rol bazlı yetkilendirmeli yeni panel.
Eski statik panel (`../CigkofteRaporPaneli/`) dokunulmadan duruyor — bu proje ayrı ve bağımsız.

- **Roller**: `admin`, `genel_mudur` (her şeyi görür/düzenler), `bolge_muduru` (kendi bölgesini
  görür + düzenler), `denetmen` (kendi şubesini görür, sadece denetim formu doldurur).
- **Güvenlik katmanı**: Row Level Security (RLS) — arayüz rolüne göre menü gizler ama gerçek
  erişim kontrolü veritabanında (`supabase/migrations/0001_init.sql`).

---

## 1) Supabase Kurulumu (bir kere, sen yapman gerekiyor)

Üçüncü parti sitelerde senin adına hesap açılamıyor — bu adımı sen tamamlamalısın:

1. [supabase.com](https://supabase.com) → ücretsiz hesap oluştur → **New Project**.
   - Proje adı: `cigkofte-panel` (istediğin bir isim)
   - Bölge: Frankfurt/Europe (Türkiye'ye en yakın)
   - Veritabanı şifresini not al (SQL editöre girmek için gerekmez ama sakla).
2. Proje hazır olunca sol menüden **SQL Editor** → **New query** → bu depodaki
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) dosyasının **tüm
   içeriğini** yapıştır → **Run**. Tüm tablolar, RLS politikaları ve fonksiyonlar oluşur.
3. **Project Settings → API** sayfasından üç değeri kopyala:
   - `Project URL`
   - `anon public` key
   - `service_role` key (⚠️ gizli — asla paylaşma / commit etme)
4. Bu klasörde `.env.local` dosyasını aç (yoksa `.env.local.example`'ı kopyala) ve 3 değeri
   yapıştır.

## 2) İlk Admin Kullanıcısını Oluşturma

Uygulama içinde "Kullanıcılar" ekranı sadece admin'e görünür — yani ilk admin'i Supabase
Dashboard'dan elle oluşturman gerekiyor:

1. Supabase Dashboard → **Authentication → Users → Add user** → e-posta/şifre gir, "Auto
   Confirm User" işaretli olsun.
2. **SQL Editor**'de şunu çalıştır (e-postayı kendi girdiğinle değiştir):
   ```sql
   insert into public.profiles (id, ad_soyad, rol)
   select id, 'Admin', 'admin' from auth.users where email = 'senin@eposta.com';
   ```
3. Artık bu kullanıcıyla `/login`'den giriş yapıp **Kullanıcılar** ekranından diğer
   Denetmen/Bölge Müdürü/Genel Müdür hesaplarını oluşturabilirsin.

## 3) Yerel Çalıştırma

```bash
npm install
npm run dev
# http://localhost:3000
```

## 4) Mevcut Veriyi Taşıma (data.json → Supabase)

`.env.local` gerçek değerlerle dolduktan sonra, **tek seferlik**:

```bash
npm run migrate
```

`../CigkofteRaporPaneli/CigkofteRaporPaneli/data/data.json` dosyasındaki tüm şubeleri ve aylık
kg verilerini Supabase'e yazar. Script idempotenttir — tekrar çalıştırırsan mükerrer kayıt
oluşturmaz (şubeler `eski_id` üzerinden eşleştirilir, aylık satışlar `(şube, yıl, ay)`
üzerinden upsert edilir).

## 5) Vercel'e Yayınlama (hosting)

1. Bu projeyi bir GitHub reposuna push et.
2. [vercel.com](https://vercel.com) → hesabınla giriş yap → **Add New Project** → GitHub
   reponu seç → **Root Directory** olarak `panel-web` klasörünü belirt.
3. **Environment Variables** kısmına `.env.local`'daki 3 değeri gir (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
4. **Deploy**. Birkaç dakika sonra `https://<proje-adı>.vercel.app` adresinde canlıya alınır.
5. (Opsiyonel) Vercel proje ayarlarından kendi alan adını (`panel.firmaniz.com`) bağlayabilirsin.

---

## Faz 1 Kapsamı

- Giriş (e-posta/şifre, Supabase Auth)
- Rol bazlı yetkilendirme (RLS ile veritabanı seviyesinde)
- Genel Bakış (rolüne göre scoplanmış temel KPI'lar)
- Şubeler (liste + ekleme + detay: aylık kg giriş tablosu + denetim formu)
- Kullanıcı yönetimi (admin-only: kullanıcı oluşturma, rol/bölge/şube atama)

**Faz 2'de eklenecekler** (henüz bu sürümde yok): Ciro & Kârlılık, Segmentasyon, KPI Takibi,
Prim Hesap, Doküman Yönetimi, Merkez Şube Gelir-Gider ve eski panelin diğer sekmeleri; ayrıca
Trello senkronunun bu veritabanına yazacak şekilde yönlendirilmesi.

## Klasör Yapısı

```
panel-web/
├── src/
│   ├── app/
│   │   ├── login/              # Giriş sayfası + server action
│   │   └── (app)/              # Girişli alan (nav + RBAC)
│   │       ├── layout.tsx      # Rol bazlı yan menü
│   │       ├── page.tsx        # Genel Bakış
│   │       ├── subeler/        # Şube listesi, detay, kg grid, denetim formu
│   │       └── kullanicilar/   # Admin-only kullanıcı yönetimi
│   ├── lib/supabase/           # client/server/admin Supabase istemcileri + oturum yenileme
│   ├── proxy.ts                # Next.js 16 "Proxy" (eski adıyla middleware) — rota koruması
│   └── types/database.ts       # Elle yazılmış TS tipleri (şema ile eşleşir)
├── supabase/migrations/0001_init.sql   # Şema + RLS politikaları
└── scripts/migrate-data-json.ts        # data.json → Supabase taşıma script'i
```
