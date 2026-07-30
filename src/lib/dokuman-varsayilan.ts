// OTOMATİK PORT — eski panelin assets/js/docs_store.js dosyasındaki
// VARSAYILAN_POZISYONLAR ve VARSAYILAN_PRIM_AYARLARI değerleri birebir taşındı.
// Kaynak, şirketin görev tanımı Word belgesi (Bölüm 8 = prim sistemi).
// Elle düzenlemeyin; içerik değişikliği panelden yapılır ve veritabanına yazılır.

export interface Pozisyon {
  id: string;
  sira: number;
  unvan: string;
  adSoyad: string;
  bagliKisi: string;
  yedek: string;
  amac: string;
  gorevlerGunluk: string;
  gorevlerHaftalik: string;
  gorevlerAylik: string;
  sorumluluklar: string;
  yetkiler: string;
  ozellikler: string;
  kpiSeti: string;
  raporlama: string;
  primBaglantisi: string;
}

export interface PrimPersonel {
  ad: string;
  unvan: string;
}

export interface PrimAyarlari {
  merkez_taban_kg: number;
  bolge1_taban_kg: number;
  bolge2_taban_kg: number;
  merkez_sube_hedef_kg: number;
  bolge1_sube_hedef_kg: number;
  bolge2_sube_hedef_kg: number;
  uretim_katsayi_tl: number;
  merkez_katsayi_tl: number;
  bolge_katsayi_tl: number;
  uretim_dagilim: { merkez: number; bolge: number; uretim: number };
  merkez_dagilim: { uretim: number; bolge: number; merkez: number };
  bolge_dagilim: { sorumlu: number; merkez: number; uretim: number };
  personel_uretim: PrimPersonel[];
  personel_merkez: PrimPersonel[];
  bolge1_ad: string;
  bolge1_unvan: string;
  bolge2_ad: string;
  bolge2_unvan: string;
  merkez_sorumlu_ad: string;
  merkez_sorumlu_unvan: string;
  acilis_ceyrek_tl: number;
  acilis_yarim_tl: number;
  acilis_tam_tl: number;
  donusum_tl: number;
  yemek_gunluk_tl: number;
  yemek_calisma_gunu: number;
  harcirah_sehir_ici_tl: number;
  harcirah_sehir_disi_tl: number;
  harcirah_gecelemeli_tl: number;
}

export const VARSAYILAN_POZISYONLAR: Pozisyon[] = [
  {
    "id": "p01",
    "sira": 1,
    "unvan": "Merkez Şubeler Sorumlusu / İdare Amiri",
    "adSoyad": "İzzet ALTUĞ",
    "bagliKisi": "Ramazan ALTUĞ (Genel Müdür)",
    "yedek": "Hüseyin AKİ (idari/depo/lojistik konularında); Metin BAŞOK / Umut Can DOĞAN (şube-franchise ilişkileri konularında karşılıklı yedekleme)",
    "amac": "Merkez üretim, depo ve lojistik operasyonlarının kesintisiz yürütülmesini; şube ve franchise ağının kurulum, denetim ve gelişim süreçlerinin şirket standartlarına uygun yönetilmesini sağlamak.",
    "gorevlerGunluk": "• İmalat, şube ve sevkiyatta çalışan personelin işe geliş-gidiş, izin ve iş durumunu takip etmek\n• Depoda eksik olan ürün ve malzemelerin siparişini geçmek ve temin etmek\n• Sabah sevkiyatı yüklemesinde şoförlere gerektiğinde yardımcı olmak\n• Franchise/şube hattından gelen talepleri değerlendirmek, saat 13:00 itibarıyla geri dönüş yapmak",
    "gorevlerHaftalik": "• Belirlenen sayı ve bölgesel plana göre şube/franchise ziyareti ve denetimi (habersiz, farklı gün/saat)\n• Şube ve franchiseların ücret kontrollerini ve ortalama ürün alımlarını kontrol etmek\n• Her Çarşamba 10:30–11:30 pazarlama-satış toplantısına katılmak\n• Haftalık yönetim toplantısına katılmak\n• Hüseyin Aki ile 15 günde bir tüm şubelerin ortak denetimini organize etmek",
    "gorevlerAylik": "• Yeni şube/franchise kuruluş ve açılış kontrollerini \"Franchise Kuruluş-Açılış Formuna\" uygun tamamlamak\n• Şube/franchise eksiklik, şikâyet ve taleplerine çözüm üretmek ve kapatma sürelerini raporlamak\n• Lojistik personelinin şube kontrol analiz ve raporlamasını değerlendirmek\n• Yanına yardımcı/yedek yetiştirmek\n• Aylık idari faaliyet ve şube-franchise durum raporunu Ramazan Bey'e sunmak",
    "sorumluluklar": "• Şirket menfaatlerini tüm sözleşme, tanıtım ve saha ilişkilerinde korumak\n• Muhataplarına eğitici, içten ve saygılı bir üslupla yaklaşmak; laubali ilişkiden kaçınmak\n• Üretimdeki çalışanların görev tanımına uygun çalışmasını sağlamak, personel arasında düzeni korumak",
    "yetkiler": "• Üretim ve şube/franchise personeline izin verme veya vermeme yetkisi\n• Görev ihmali tespit edilen personele ikaz, ihtar ve gerekli görülürse cezai müeyyide uygulama\n• Ramazan Bey olmadığında onay dahilinde ödeme yapma\n• Kritik konularda yönetim kurulundan toplantı talep etme",
    "ozellikler": "• Yüksek iletişim, analiz ve problem çözme becerisi\n• Excel ve şirket muhasebe/ERP sisteminde işlem-analiz-raporlama yapabilme\n• B sınıfı sürücü belgesi\n• Çiğköfte üretim sürecine hakimiyet",
    "kpiSeti": "1. Aylık habersiz şube/franchise denetim sayısı → Hedef: Planlananın ≥ %90'ı | Denetim formu | Aylık\n2. Şube/franchise şikâyeti ort. çözüm süresi → Hedef: ≤ 3 iş günü | Şikâyet takip | Aylık\n3. Depo/stok eksikliği kaynaklı üretim aksama sayısı → Hedef: 0 | Depo takip | Aylık\n4. Yeni şube/franchise kuruluş SLA uyumu → Hedef: ≥ %95 | Kuruluş-Açılış Formu | Aylık\n5. Ekipte plansız devamsızlık oranı → Hedef: ≤ %3 | Personel takip | Aylık",
    "raporlama": "• Haftalık Şube/Franchise Denetim Raporu → Haftalık (Cuma) → Ramazan ALTUĞ\n• Haftalık Yönetim Toplantısı Notu → Haftalık (Çarşamba) → Yönetim\n• Aylık İdari Faaliyet ve Şube-Franchise Durum Raporu → Aylık (ayın 1'i) → Ramazan ALTUĞ",
    "primBaglantisi": "• Genel İdari Prim\n• Miktar (Tonaj) Primi — Merkez Şube bileşeni\n• Tutar (Ciro) Primi — genel aşım bileşeni\n• Harcırah"
  },
  {
    "id": "p02",
    "sira": 2,
    "unvan": "Franchise Bölge Şube Sorumlusu (Bölge 1)",
    "adSoyad": "Metin BAŞOK",
    "bagliKisi": "Ramazan ALTUĞ (Genel Müdür)",
    "yedek": "Umut Can DOĞAN",
    "amac": "Sorumlu olduğu bölgedeki franchise ve merkez şubelerin açılış, denetim, ciro/tonaj ve ilişki yönetimini yürütmek; franchise kanalının büyümesini standartlara uygun şekilde yönetmek.",
    "gorevlerGunluk": "• Şirket sabit hattından gelen aramalara geri dönüş yapmak\n• Rut planına uygun olarak bayi/şube ziyaret ve denetimlerini yapmak\n• Franchise personelini şirket kural, prosedür ve uygulamalarına göre eğitmek\n• Franchise talebinde bulunanları saat 13:00 itibarıyla arayarak bilgilendirmek\n• Talep sahiplerinin kişilik, çevre ve sosyal durumunu analiz etmek\n• Bölgesindeki şube/franchise'lardan gelen operasyonel talep ve sorunları takip etmek",
    "gorevlerHaftalik": "• Rut planlarını düzenlemek ve planlı denetim yapmak\n• Pazar araştırması ve analizleri yaparak pazar/satış büyütme faaliyetleri tasarlamak\n• Belirlenen sayı ve bölgesel plana göre franchise ziyareti ve denetimi (habersiz)\n• Mevcut franchiseların ücret kontrolü ve ortalama ürün alımını kontrol edip yönetime sunmak\n• Her Çarşamba 10:30–11:30 pazarlama-satış toplantısına katılmak\n• Haftalık yönetim toplantısına katılmak\n• Bölge ciro ve tonaj gerçekleşmesini takip etmek",
    "gorevlerAylik": "• Franchise açılışlarını organize etmek, açılış ve kurulumu forma göre yapmak\n• Bölge satış/performans raporu hazırlamak\n• Uygun bulunan yerler için yer ekspertizi yapmak\n• Bölgesindeki E segment şubeler için aksiyon planı önermek\n• Bölge performans ve segmentasyon raporunu hazırlamak\n• Yanına yardımcı/yedek yetiştirmek",
    "sorumluluklar": "• Şirketle ilgili sözleşme ve tanıtım konularında şirket menfaatlerini korumak\n• Eğitici ve yol gösterici bir üslup benimsemek; aşırı samimi ilişkilerden kaçınmak\n• Denetimleri değişken gün/saatte, habersiz yapmak\n• Bölge içi iletişimi düzenli ve saygılı yürütmek",
    "yetkiler": "• Kritik konularda yönetimden toplantı talep etmek\n• Şirket aracını görev kapsamında kullanmak\n• Bölge kapsamında kritik konuları yönetime iletme",
    "ozellikler": "• Yüksek iletişim, analiz, raporlama ve problem çözme becerisi\n• Planlı çalışma, güçlü iletişim, motive edici konuşma becerisi\n• Seyahat engeli olmama, aktif araç kullanımı\n• Excel ve muhasebe programında işlem yapabilme\n• B sınıfı sürücü belgesi",
    "kpiSeti": "1. Bölge aylık toplam satış (ton) hedef gerçekleşme oranı → ≥ %100 (bölge normu) | Şube Database | Aylık\n2. Bölge şube denetim kapsama oranı → ≥ %90 | Denetim formu | Aylık\n3. Bölgedeki E segment şube sayısındaki değişim → Azalış yönünde | Segmentasyon raporu | Dönemsel\n4. Yeni şube/franchise açılış sayısı → Hedefe göre | Kuruluş Formu | Aylık\n5. Şube şikâyeti ort. çözüm süresi → ≤ 3 iş günü | Şikâyet takip | Aylık\n6. Aylık yeni franchise başvuru→kuruluş dönüşüm oranı → ≥ %25 | Başvuru takip | Aylık\n7. Ortalama başvuruya ilk dönüş süresi → Aynı gün (13:00'e kadar) | Arama kaydı | Günlük",
    "raporlama": "• Haftalık Bölge Şube Durum Raporu → Haftalık → Ramazan ALTUĞ\n• Günlük Saha Ziyaret Kaydı → Günlük → Ramazan ALTUĞ\n• Aylık Bölge Performans ve Segmentasyon Raporu → Aylık → Ramazan ALTUĞ\n• Haftalık Franchise Ziyaret ve Denetim Raporu → Haftalık (Cuma) → Ramazan ALTUĞ",
    "primBaglantisi": "• Miktar (Tonaj) Primi — bölgesel eşik aşımı (Bölge 1)\n• Tutar (Ciro) Primi — bölgesel bileşen\n• Yeni Şube/Franchise Açılış Primi (asıl sorumlu)\n• Şube Marka Dönüşüm Primi\n• Harcırah"
  },
  {
    "id": "p03",
    "sira": 3,
    "unvan": "Franchise Bölge Şube Sorumlusu (Bölge 2)",
    "adSoyad": "Umut Can DOĞAN",
    "bagliKisi": "Ramazan ALTUĞ (Genel Müdür)",
    "yedek": "Metin BAŞOK",
    "amac": "Sorumlu olduğu bölgedeki franchise ve merkez şubelerin açılış, denetim, ciro/tonaj ve ilişki yönetimini yürütmek; franchise kanalının büyümesini standartlara uygun şekilde yönetmek.",
    "gorevlerGunluk": "• Şirket sabit hattından gelen aramalara geri dönüş yapmak\n• Rut planına uygun olarak bayi/şube ziyaret ve denetimlerini yapmak\n• Franchise personelini şirket kural, prosedür ve uygulamalarına göre eğitmek\n• Franchise talebinde bulunanları saat 13:00 itibarıyla arayarak bilgilendirmek\n• Talep sahiplerinin kişilik, çevre ve sosyal durumunu analiz etmek\n• Bölgesindeki şube/franchise'lardan gelen operasyonel talep ve sorunları takip etmek",
    "gorevlerHaftalik": "• Rut planlarını düzenlemek ve planlı denetim yapmak\n• Pazar araştırması ve analizleri yaparak pazar/satış büyütme faaliyetleri tasarlamak\n• Belirlenen sayı ve bölgesel plana göre franchise ziyareti ve denetimi (habersiz)\n• Mevcut franchiseların ücret kontrolü ve ortalama ürün alımını kontrol edip yönetime sunmak\n• Her Çarşamba 10:30–11:30 pazarlama-satış toplantısına katılmak\n• Haftalık yönetim toplantısına katılmak\n• Bölge ciro ve tonaj gerçekleşmesini takip etmek",
    "gorevlerAylik": "• Franchise açılışlarını organize etmek, açılış ve kurulumu forma göre yapmak\n• Bölge satış/performans raporu hazırlamak\n• Uygun bulunan yerler için yer ekspertizi yapmak\n• Bölgesindeki E segment şubeler için aksiyon planı önermek\n• Bölge performans ve segmentasyon raporunu hazırlamak\n• Yanına yardımcı/yedek yetiştirmek",
    "sorumluluklar": "• Şirketle ilgili sözleşme ve tanıtım konularında şirket menfaatlerini korumak\n• Eğitici ve yol gösterici bir üslup benimsemek; aşırı samimi ilişkilerden kaçınmak\n• Denetimleri değişken gün/saatte, habersiz yapmak\n• Bölge içi iletişimi düzenli ve saygılı yürütmek",
    "yetkiler": "• Kritik konularda yönetimden toplantı talep etmek\n• Şirket aracını görev kapsamında kullanmak\n• Bölge kapsamında kritik konuları yönetime iletme",
    "ozellikler": "• Yüksek iletişim, analiz, raporlama ve problem çözme becerisi\n• Planlı çalışma, güçlü iletişim, motive edici konuşma becerisi\n• Seyahat engeli olmama, aktif araç kullanımı\n• Excel ve muhasebe programında işlem yapabilme\n• B sınıfı sürücü belgesi",
    "kpiSeti": "1. Bölge aylık toplam satış (ton) hedef gerçekleşme oranı → ≥ %100 (bölge normu) | Şube Database | Aylık\n2. Bölge şube denetim kapsama oranı → ≥ %90 | Denetim formu | Aylık\n3. Bölgedeki E segment şube sayısındaki değişim → Azalış yönünde | Segmentasyon raporu | Dönemsel\n4. Yeni şube/franchise açılış sayısı → Hedefe göre | Kuruluş Formu | Aylık\n5. Şube şikâyeti ort. çözüm süresi → ≤ 3 iş günü | Şikâyet takip | Aylık\n6. Aylık yeni franchise başvuru→kuruluş dönüşüm oranı → ≥ %25 | Başvuru takip | Aylık\n7. Ortalama başvuruya ilk dönüş süresi → Aynı gün (13:00'e kadar) | Arama kaydı | Günlük",
    "raporlama": "• Haftalık Bölge Şube Durum Raporu → Haftalık → Ramazan ALTUĞ\n• Günlük Saha Ziyaret Kaydı → Günlük → Ramazan ALTUĞ\n• Aylık Bölge Performans ve Segmentasyon Raporu → Aylık → Ramazan ALTUĞ\n• Haftalık Franchise Ziyaret ve Denetim Raporu → Haftalık (Cuma) → Ramazan ALTUĞ",
    "primBaglantisi": "• Miktar (Tonaj) Primi — bölgesel eşik aşımı (Bölge 2)\n• Tutar (Ciro) Primi — bölgesel bileşen\n• Yeni Şube/Franchise Açılış Primi (asıl sorumlu)\n• Şube Marka Dönüşüm Primi\n• Harcırah"
  },
  {
    "id": "p04",
    "sira": 4,
    "unvan": "Müdür Yardımcısı",
    "adSoyad": "(Atanacak)",
    "bagliKisi": "Ramazan ALTUĞ (Genel Müdür)",
    "yedek": "İzzet ALTUĞ",
    "amac": "Genel Müdüre tüm proje ve görevlerde yardımcı olmak; günlük operasyonun koordinasyonunu ve denetimini sağlamak.",
    "gorevlerGunluk": "• Günlük işleri koordine etmek ve denetlemek",
    "gorevlerHaftalik": "• Tedarik, personel ve bütçe kaynaklarını planlamak\n• Çalışan performansını değerlendirmek",
    "gorevlerAylik": "• Personeller arası uyuşmazlıkları çözmek\n• Tüm proje ve görevlerde Genel Müdüre yardımcı olmak",
    "sorumluluklar": "• Firmanın hedeflerine ve gelişimine katkı sağlamak\n• Personele gerektiğinde rehberlik etmek",
    "yetkiler": "• Müdürün olmadığı durumlarda hizmet alımlarına onay verme\n• Ödeme planına göre hizmet alınan firmalara ödeme yapma",
    "ozellikler": "• Koordinasyon ve liderlik becerisi\n• Bütçe/kaynak planlama deneyimi",
    "kpiSeti": "1. Koordine edilen projelerin zamanında tamamlanma oranı → ≥ %85 | Proje takip (Trello) | Aylık\n2. Departmanlar arası eskale sorun ort. çözüm süresi → ≤ 5 iş günü | Sorun takip kaydı | Aylık\n3. Bütçe/kaynak planlama sapma oranı → ≤ %10 | Bütçe raporu | Aylık",
    "raporlama": "• Haftalık Yönetim Özet Raporu → Haftalık → Ramazan ALTUĞ\n• Aylık Operasyon Değerlendirme Raporu → Aylık → Ramazan ALTUĞ",
    "primBaglantisi": "• Genel İdari Prim"
  },
  {
    "id": "p05",
    "sira": 5,
    "unvan": "Muhasebe Sorumlusu",
    "adSoyad": "Gamze DAĞ",
    "bagliKisi": "Ramazan ALTUĞ (Genel Müdür)",
    "yedek": "Ümran BALCI",
    "amac": "Şirketin mali işlemlerinin, resmi evrak süreçlerinin ve raporlamasının eksiksiz, zamanında ve mevzuata uygun yürütülmesini sağlamak.",
    "gorevlerGunluk": "• Ziraat Katılım Bankası EFT listelerini hazırlamak ve işlemek\n• Satış faturalarını kesmek ve takip etmek; alış faturalarını sisteme girmek\n• Franchise bakiyelerini kontrol etmek, ödeme yapmamış bayilerden tahsilat sağlamak\n• Şirket maillerini kontrol etmek, gerekli kişilere yönlendirmek\n• Cari takip için bayilerle telefon görüşmelerini saat 13:00 sonrası gerçekleştirmek",
    "gorevlerHaftalik": "• Stok sayımını Hüseyin Bey ile takip etmek, sisteme işlemek\n• Tedarik edilmesi gereken ürünleri İzzet Bey ile kontrol edip sipariş sürecini başlatmak",
    "gorevlerAylik": "• Her ayın 5'inde tüm aylık raporları hazırlamak (şube kâr-zarar, genel mali rapor dahil)\n• Her ayın 10'unda tedarikçi ödemelerini ve internet-su-elektrik faturalarını Ramazan Bey'e iletmek\n• Ay sonu maaş listelerini Ramazan Bey'e iletmek, banka maaş takibini yapmak; bordroları kontrol etmek\n• Dükkan kira listesini güncel tutup ay başında Ramazan Bey'e iletmek\n• Resmi evrak (SGK, mali müşavir, araç/şube ruhsat vb.) takibi ve dosyalama\n• Personel özlük dosyaları, işe giriş-çıkış, banka hesap açılış süreçlerini takip etmek",
    "sorumluluklar": "• Tüm işlemleri muhasebe prosedürüne uygun yapmak\n• Kendisine verilen belge ve ofis bilgisayarından sorumlu olmak",
    "yetkiler": "",
    "ozellikler": "• Ön muhasebe bilgisi\n• Word ve Excel'de ileri düzey yetkinlik\n• İyi diksiyon ve iletişim becerisi",
    "kpiSeti": "1. Aylık raporların zamanında teslimi → Her ayın 5'i — %100 | Rapor arşivi | Aylık\n2. Fatura/EFT işleme hata oranı → ≤ %1 | Muhasebe sistemi | Aylık\n3. Franchise tahsilat gecikme oranı → ≤ %5 | Cari takip | Aylık\n4. Ödeme SLA uyumu (ayın 10'u) → %100 | Ödeme takip | Aylık\n5. Şube kâr-zarar raporu doğruluk ve zamanlaması → Sapma yok, zamanında | Mali rapor | Aylık",
    "raporlama": "• Günlük Cari/Tahsilat Özeti → Günlük → Muhasebe Sorumlusu\n• Haftalık Stok-Mali Uyum Raporu → Haftalık → Muhasebe Sorumlusu\n• Aylık Şube Kâr-Zarar ve Genel Mali Rapor → Aylık (ayın 5'i) → Ramazan ALTUĞ",
    "primBaglantisi": "• Genel İdari Prim\n• Yemek Yardımı bordro uygulayıcılığı"
  },
  {
    "id": "p06",
    "sira": 6,
    "unvan": "Ofis Destek Elemanı",
    "adSoyad": "Elif TUNCA",
    "bagliKisi": "Muhasebe Sorumlusu (Gamze DAĞ)",
    "yedek": "Ümran BALCI",
    "amac": "Ofis içi operasyonel destek, toplantı organizasyonu ve dijital platform (Trendyol/Yemeksepeti vb.) takibinin düzenli yürütülmesini sağlamak.",
    "gorevlerGunluk": "• Çayı sabah 08:00 ve öğlen 13:00'te hazırlamak; misafir karşılama ve yönlendirme yapmak\n• Trendyol, Yemeksepeti vb. platformların açılış-kapanış ve kampanya süreçlerini takip etmek\n• Şubelerin ciro fişi takibini ve sistem girişini yapmak\n• Telefon/Instagram/\"Bayim Olur Musun\" portalından gelen franchise taleplerini ön görüşme sonrası Franchise Saha Sorumlusu'na iletmek",
    "gorevlerHaftalik": "• Haftalık toplantıları planlamak, gündem belirlemek, tutanak tutup katılımcılara iletmek\n• Ofis kırtasiye/temizlik/mutfak malzemesi eksiklerini tedarik etmek",
    "gorevlerAylik": "• Mutfak malzemelerini haftada bir klorlu su ile yıkamak\n• Mesai dışı sabit hat aramalarına geri dönüş yapmak",
    "sorumluluklar": "• Çalışma saatlerine (08:00–17:00) uymak\n• Hijyen kurallarına dikkat etmek\n• Kurumsal belgelerin gizliliğini korumak",
    "yetkiler": "",
    "ozellikler": "• İyi iletişim ve organizasyon becerisi\n• Temel Office/Excel bilgisi",
    "kpiSeti": "1. Toplantı tutanağının zamanında dağıtım oranı → %100 (toplantı sonrası aynı gün) | Tutanak arşivi | Haftalık\n2. Franchise ön görüşme → ilgili birime yönlendirme süresi → ≤ 1 iş günü | Talep takip | Haftalık\n3. Platform (Trendyol/Yemeksepeti) durum hata oranı → 0 hatalı açık/kapalı durumu | Platform kontrol | Günlük\n4. Ciro fişi günlük sisteme giriş tamlığı → %100 | Sistem kaydı | Günlük",
    "raporlama": "• Günlük Platform Durum Kontrolü → Günlük → Muhasebe Sorumlusu\n• Haftalık Toplantı Tutanağı → Haftalık → Yönetim / Katılımcılar\n• Aylık Ofis Faaliyet Özeti → Aylık → Muhasebe Sorumlusu",
    "primBaglantisi": "• Genel İdari Prim"
  },
  {
    "id": "p07",
    "sira": 7,
    "unvan": "Sipariş Birimi Yetkilisi",
    "adSoyad": "Ümran BALCI",
    "bagliKisi": "Muhasebe Sorumlusu",
    "yedek": "Elif TUNCA (ofis konularında) / Gamze DAĞ (muhasebe konularında) — karşılıklı",
    "amac": "Sipariş alım, üretime iletim ve sevkiyata çıkış süreçlerinin zamanında, eksiksiz ve izlenebilir şekilde yürütülmesini sağlamak.",
    "gorevlerGunluk": "• Sabah 08:00–09:00 arasında sipariş listesini oluşturup üretim şefine ve köfte ustasına teslim etmek\n• Bir önceki akşam saat 20:00'de gruplara sipariş hatırlatma mesajı atmak\n• Sevkiyat araçlarına e-irsaliye çıkarmak, günlük köfte etiketi çıkarmak ve SKT takibini yapmak\n• Kargo ile gidecek kolilerin etiketlerini çıkarmak; günlük koli adedi/kilosunu Excel'e işleyip kargo yetkilisine iletmek\n• İmalat yerindeki dükkan fişlerinin günlük sisteme girişini sağlamak",
    "gorevlerHaftalik": "• Bireysel müşteri (B2C — Hepsiburada, Trendyol vb.) sipariş süreçlerini takip etmek\n• Etiket stok takibini yaparak azalan etiketlerin siparişini vermek",
    "gorevlerAylik": "• Düzenli sipariş vermeyen bayileri Franchise Saha Sorumlusu'na bildirmek\n• Yeni franchise eklendiğinde cari ve kullanıcı açılışını yapmak, eğitim videolarıyla birlikte iletmek\n• Stok sayımı sonrası eksik ürünlerin sipariş tedarikini yapmak",
    "sorumluluklar": "• Çalışma saatlerine uymak\n• Müşteri şikâyetlerini dinleyip yetkiliyle çözüm bulmak\n• Gıdaların güvenilir şekilde ulaştırılmasını sağlamak",
    "yetkiler": "• Aylık fabrika, dönemsel şube ilaçlama süreçlerini yönetme",
    "ozellikler": "• Detay odaklılık, çoklu görev yönetme becerisi\n• Excel ve sipariş/ERP sistemi kullanımı",
    "kpiSeti": "1. Sipariş listesinin 08:00–09:00 SLA'sına uyum oranı → %100 | Sipariş kaydı | Günlük\n2. Etiket/SKT hata oranı → 0 | Etiket kontrol kaydı | Günlük\n3. Düzensiz sipariş veren bayinin tespit → bildirim süresi → ≤ 1 iş günü | Franchise sipariş takip | Haftalık\n4. B2C sipariş işleme SLA uyumu → ≥ %95 | Platform sipariş kaydı | Haftalık",
    "raporlama": "• Günlük Sipariş ve Sevkiyat Listesi → Günlük → Üretim / Sevkiyat\n• Haftalık/Aylık Sipariş Disiplin Raporu → Haftalık ve Aylık → Muhasebe Sorumlusu",
    "primBaglantisi": "• Genel İdari Prim"
  },
  {
    "id": "p08",
    "sira": 8,
    "unvan": "Gıda Mühendisi (Üretim ve Kalite Sorumlusu)",
    "adSoyad": "Tuğçe MOLLAOĞLU",
    "bagliKisi": "Ramazan ALTUĞ (Genel Müdür)",
    "yedek": "Usta Başı (günlük saha kontrollerinde)",
    "amac": "Üretim süreçlerinin gıda güvenliği, hijyen ve kalite standartlarına uygun yürütülmesini kayıt altına almak ve sürdürmek.",
    "gorevlerGunluk": "• Hammaddelerin parti numarası ve STT (son tüketim tarihi) kontrolünü yapmak\n• Kuru gıda deposu, soğuk oda ve üretim alanı sıcaklıklarını kontrol formuna işlemek\n• Üretim bitiminde temizlik kontrolü yapmak, sorunları İzzet Bey'e iletmek\n• Personel temizlik/hijyen formunu tutmak",
    "gorevlerHaftalik": "• Özel sos ve acı sos üretimlerinde brix, üretim miktarı, STT ve tarih bilgilerini kayıt altına almak\n• Bubbi dürüm üretiminde köfte/lavaş/acı sos parti-STT kontrolünü yapmak ve kayıt tutmak",
    "gorevlerAylik": "• Üretim cihazlarının yıllık kalibrasyon planlamasını takip etmek\n• Ayda 1 yapılan ilaçlama takibini yürütmek, MSDS raporlarını tutmak\n• Gramaj kontrol formunu düzenli tutmak; ürün/acı sos etiketlerini hazırlamak",
    "sorumluluklar": "• Kişisel temizlik, kılık-kıyafet kurallarına uymak\n• Üretim alanı hijyenine özen göstermek, yabancı kişi/cisim bulundurmamak",
    "yetkiler": "• Üretimde tespit edilen aksaklıkları durdurma/bildirme yetkisi",
    "ozellikler": "• Gıda Mühendisliği lisans mezuniyeti\n• HACCP/gıda güvenliği mevzuatına hakimiyet\n• Detaylı kayıt tutma disiplini",
    "kpiSeti": "1. Günlük kontrol formu doldurma tamlık oranı → %100 | Kalite kontrol formları | Günlük\n2. STT/parti numarası uygunsuzluk sayısı → 0 | Kontrol formu | Aylık\n3. Hijyen denetim uygunluk oranı → ≥ %95 | Hijyen denetim formu | Haftalık\n4. Kalibrasyon/ilaçlama planına zamanında uyum → %100 | Kalibrasyon/ilaçlama planı | Yıllık/Aylık\n5. Ürün gramaj sapma oranı (tolerans dışı) → ≤ %2 | Gramaj kontrol formu | Haftalık",
    "raporlama": "• Günlük Üretim Kalite Kontrol Formu → Günlük → Gıda Mühendisi\n• Haftalık Hijyen ve Sos Üretim Raporu → Haftalık → Gıda Mühendisi\n• Aylık Kalite, Kalibrasyon ve İlaçlama Raporu → Aylık → Ramazan ALTUĞ",
    "primBaglantisi": "• Genel İdari Prim (kalite/verimlilik bileşeni)\n• Miktar (Tonaj) Primi — üretim ekibi payı"
  },
  {
    "id": "p09",
    "sira": 9,
    "unvan": "Usta Başı",
    "adSoyad": "Feras BEY",
    "bagliKisi": "Gıda Mühendisi",
    "yedek": "Kıdemli Üretim Personeli (atanacak)",
    "amac": "Günlük çiğköfte üretiminin sipariş listesine uygun miktar, kalite ve zamanlamada gerçekleştirilmesini sağlamak.",
    "gorevlerGunluk": "• Akşam 05:00 iş başı yapmak, sipariş hattından günlük listeyi WhatsApp üzerinden almak\n• Partiden çıkan köfteleri 5–10 kiloluk tartıp paketlemek, vakumlayıp palete dizmek\n• Köfteyi istenen formda (normal/acılı/cevizli) ve miktarda hazırlamak\n• 2. dinlendirme sonrası bulgurun 21–22°C'ye soğuduğundan emin olmak\n• Partilerdeki köfte miktarını sipariş hattına bildirerek etiketin doğru sayıda çıkmasını sağlamak\n• Günlük üretim bitiminde çelik masa ve yoğurma makinelerini temizlemek",
    "gorevlerHaftalik": "• Perşembe günü acı sos ve çok acı sos üretim/dolumunda görev almak\n• Stoğu biten ürünleri ve arızaları İzzet Altuğ'a / Gıda Mühendisi'ne bildirmek",
    "gorevlerAylik": "• Ertesi gün için belirlenen miktarda köfte hazırlayıp soğuk depoda muhafaza ettirmek (rutin)",
    "sorumluluklar": "• Kişisel temizlik ve kılık-kıyafet kurallarına uymak\n• Üretim alanı hijyenine özen göstermek",
    "yetkiler": "• Üretim hattında iş dağılımını organize etme",
    "ozellikler": "• Çiğköfte üretim ustalığı\n• Ekip yönetimi ve zaman baskısı altında çalışabilme",
    "kpiSeti": "1. Günlük üretim planı gerçekleşme oranı → ≥ %98 | Sipariş/üretim kaydı | Günlük\n2. Fire / hatalı paket oranı → ≤ %1 | Üretim kayıt formu | Günlük\n3. Stok/arıza bildirim süresi → Aynı gün | Bildirim kaydı | Günlük\n4. Soğutma sıcaklık standardına uyum (21–22°C) → %100 | Sıcaklık kontrol formu | Günlük",
    "raporlama": "• Günlük Üretim Miktar Bildirimi → Günlük → Sipariş Birimi / Gıda Mühendisi\n• Haftalık Fire ve Verimlilik Özeti → Haftalık → Gıda Mühendisi",
    "primBaglantisi": "• Miktar (Tonaj) Primi — üretim ekibi payı\n• Genel İdari Prim\n• Yemek Yardımı"
  },
  {
    "id": "p10",
    "sira": 10,
    "unvan": "Üretim Personeli (Çiğköfte)",
    "adSoyad": "Hossam ALRAJAB / Muhammed ABDULLAH (Vardiya Ekibi)",
    "bagliKisi": "Gıda Mühendisi / Usta Başı",
    "yedek": "Vardiya arkadaşları arası rotasyon (çapraz eğitim önerilir)",
    "amac": "Üretim hattında günlük köfte üretimini standartlara uygun gerçekleştirmek.",
    "gorevlerGunluk": "• Akşam 05:00 iş başı yapmak; ocakları açıp suyu kaynatmak, davlumbazı çalıştırmak\n• Bulguru tepsilere et suyu/baharat ile hazırlamak\n• Partiden çıkan köfteleri tartıp paketlemek, vakumlayıp palete dizmek\n• Soğuk depodan salça/yağ/ketçap gibi ürünleri kazana eklemeye hazır hale getirmek\n• Günlük üretim bitiminde çelik masa, makine içi ve zemini temizlemek",
    "gorevlerHaftalik": "• Soğuk depo stoklarını (yağ, salça, ketçap) takip edip azaldığında bildirmek",
    "gorevlerAylik": "",
    "sorumluluklar": "• Kişisel temizlik ve hijyen kurallarına uymak\n• Üretim alanına yabancı kişi/cisim almamak",
    "yetkiler": "",
    "ozellikler": "• Fiziksel dayanıklılık, takım çalışmasına yatkınlık\n• Gece vardiyasına uyum",
    "kpiSeti": "1. Vardiya devamlılık oranı → ≥ %97 | Puantaj | Aylık\n2. Günlük üretim hedefine katkı (kişi başı ort.) → Hedefe göre | Üretim kaydı | Günlük\n3. Hijyen kurallarına uyum denetim puanı → ≥ 90/100 | Hijyen denetimi | Haftalık",
    "raporlama": "• Günlük üretim ve devam bilgisi (Usta Başı üzerinden konsolide) → Günlük → Usta Başı",
    "primBaglantisi": "• Miktar (Tonaj) Primi — üretim ekibi payı\n• Yemek Yardımı"
  },
  {
    "id": "p11",
    "sira": 11,
    "unvan": "Sos Üretim Personeli",
    "adSoyad": "Ahmet SARI (Görevli Personel)",
    "bagliKisi": "Gıda Mühendisi",
    "yedek": "Üretim Personeli (çapraz eğitimli)",
    "amac": "Nar ekşisi, acı sos ve diğer sosların üretim planına uygun, hijyenik ve zamanında üretilmesini sağlamak.",
    "gorevlerGunluk": "• Glikoz geldiğinde kazanlara doldurulmasını sağlamak\n• Üretilen sosu dolum sistemiyle şişelere doldurmak, etiketleme cihazını hazırlamak\n• Sos üretim günlerinde günlük temizlik yapmak\n• Stick/mini sos üretiminde koli başı 250 adet paketleme standardına uymak",
    "gorevlerHaftalik": "• Nar ekşisi sosu üretimini günde 100 koli olacak şekilde 12 günde tamamlamak\n• Çarşamba günleri acı sos şişe kapaklarının dolum hattında sıkılaştırılmasını sağlamak\n• Salı günleri otobüs sevkiyatı için koli hazırlığına yardım etmek",
    "gorevlerAylik": "• Şişe/kapak/ambalaj/etiket stok takibini yapmak, idari birimle sipariş sürecini yürütmek\n• Makine bakım/arıza ve değişecek parça ihtiyacını yönetime bildirmek",
    "sorumluluklar": "• Kişisel temizlik ve hijyen kurallarına uymak\n• Üretim alanına yabancı kişi/cisim almamak",
    "yetkiler": "",
    "ozellikler": "• Detay odaklılık, makine kullanım becerisi",
    "kpiSeti": "1. Aylık sos üretim planı gerçekleşme oranı (koli) → ≥ %95 | Üretim kaydı | Aylık\n2. Etiket/SKT hata oranı → 0 | Etiket kontrol | Haftalık\n3. Stok kesintisi kaynaklı üretim durma sayısı → 0 | Stok takip | Aylık",
    "raporlama": "• Haftalık Sos Üretim ve Stok Raporu → Haftalık → Gıda Mühendisi / Sos Üretim Personeli",
    "primBaglantisi": "• Miktar (Tonaj) Primi — üretim ekibi payı\n• Yemek Yardımı"
  },
  {
    "id": "p12",
    "sira": 12,
    "unvan": "Sevkiyat Sorumlusu (Şoför)",
    "adSoyad": "(Sevkiyat Ekibi — 3 Personel)",
    "bagliKisi": "İzzet ALTUĞ",
    "yedek": "Hüseyin AKİ",
    "amac": "Ürünlerin bayi/şubelere zamanında, eksiksiz ve gıda güvenliği standartlarına uygun teslim edilmesini sağlamak.",
    "gorevlerGunluk": "• Mesaiye 09:30–10:00 arası başlamak, aracı yükleme bölümüne konumlandırmak\n• O günkü bölgenin sipariş listesini Sipariş Birimi'nden teslim almak; araçta kaba temizlik yapmak\n• Listedeki ürünleri zamanında ve eksiksiz araca yüklemek, ambalaj kontrolü yapmak\n• Rut planına göre teslimatları yapmak; teslim alan yetkiliye imza attırmak\n• Fazla/eksik teslim durumlarını sevkiyat listesine not düşmek",
    "gorevlerHaftalik": "• Bayi/şube gözlemlerini (temizlik, çalışma şekli, açılış saati vb.) yönetime bildirmek\n• Otobüs sevkiyat günlerinde otobüs firması bilgilerini Sipariş Birimi'ne iletmek",
    "gorevlerAylik": "• Aracın yakıt, AdBlue, yağ ihtiyaçlarını karşılamak; bakım/muayene süreçlerini takip etmek",
    "sorumluluklar": "• Gıda güvenliği standartlarına uygun teslimat yapmak\n• Güvenli sürüş, araç bakım ve temizliğinden sorumlu olmak",
    "yetkiler": "• Gerektiğinde sevkiyat planında değişiklik yapma\n• Arıza durumunda aracı yetkili servise götürme",
    "ozellikler": "• B/C sınıfı sürücü belgesi\n• Güzergah bilgisi, zaman yönetimi becerisi",
    "kpiSeti": "1. Zamanında teslimat oranı → ≥ %98 | Teslimat formu (imzalı) | Günlük\n2. Eksik/hatalı teslimat sayısı → 0 | Sevkiyat listesi | Günlük\n3. Önlenebilir araç arıza/kaza sayısı → 0 | Araç takip kaydı | Aylık\n4. İmzalı teslim belgesi tamlık oranı → %100 | Teslimat arşivi | Günlük",
    "raporlama": "• Günlük Teslimat Formu (imzalı) → Günlük → Sipariş Birimi / Muhasebe Sorumlusu\n• Haftalık Rut Performans Özeti → Haftalık → Sipariş Sorumlusu",
    "primBaglantisi": "• Harcırah\n• Genel İdari Prim\n• Yemek Yardımı"
  },
  {
    "id": "p13",
    "sira": 13,
    "unvan": "Depo ve Genel İşler Sorumlusu",
    "adSoyad": "Hüseyin AKİ",
    "bagliKisi": "Ramazan ALTUĞ (Genel Müdür)",
    "yedek": "İzzet ALTUĞ",
    "amac": "Depo, sevkiyat desteği ve şirketin resmi/operasyonel işlerinin aksatılmadan yürütülmesini sağlamak.",
    "gorevlerGunluk": "• İşe başlama 08:00, bitiş 18:00\n• Depodaki ürünlerden sorumlu olmak, eksik malzemeleri İzzet Bey'e liste halinde bildirmek\n• Kargo, otobüs ve yeni franchise kolilerini hazırlamak\n• Sabah sevkiyat yüklemesinde şoförlere yardımcı olmak",
    "gorevlerHaftalik": "• Şoför eksikliğinde yerine şoförlük yapmak\n• Dükkanların ruhsat/evrak/arıza gibi resmi işlem takibini yapmak",
    "gorevlerAylik": "• 15 günde bir tüm şubelerin denetimini İzzet Bey ile birlikte yapmak\n• Araçların tamir/muayene işlemlerini yürütmek\n• İzzet Bey olmadığında onun görevlerini yerine getirmek",
    "sorumluluklar": "• Depo düzeni ve stok doğruluğundan sorumlu olmak\n• Acil durumlarda (personel eksikliği vb.) şubelere destek olmak",
    "yetkiler": "• Ramazan Bey'in bilgisi dahilinde depo/sevkiyat önceliklendirmesi yapma",
    "ozellikler": "• Çok yönlü operasyonel beceri\n• B sınıfı sürücü belgesi",
    "kpiSeti": "1. Depo stok eksikliği bildirim süresi → Aynı gün | Eksik listesi | Günlük\n2. 15 günlük ortak şube denetim planı gerçekleşme oranı → %100 | Denetim raporu | Dönemsel\n3. Araç bakım/muayene zamanında tamamlanma oranı → %100 | Araç takip kaydı | Aylık\n4. Acil durum müdahale süresi → Aynı gün | Vardiya kaydı | Aylık",
    "raporlama": "• Haftalık Depo Stok Durum Raporu → Haftalık → Depo Sevkiyat Sorumlusu / Muhasebe Sorumlusu\n• 15 Günlük Ortak Şube Denetim Raporu → Dönemsel → Ramazan ALTUĞ",
    "primBaglantisi": "• Genel İdari Prim\n• Harcırah"
  },
  {
    "id": "p14",
    "sira": 14,
    "unvan": "Merkez Şube / Depo Satış Personeli",
    "adSoyad": "Mehmet ÖZBEK",
    "bagliKisi": "İzzet ALTUĞ",
    "yedek": "(Atanacak — kıdemli üretim/depo personeli önerilir)",
    "amac": "Merkez şubenin günlük satış, hijyen ve müşteri karşılama standartlarına uygun işletilmesini sağlamak.",
    "gorevlerGunluk": "• Çalışma saatleri 08:00–20:00; sabah tezgahı açmak, kalan köfte/lavaşı saymak\n• Dükkan temizliğini günlük aksatmadan yapmak, rafların düzenine dikkat etmek\n• Gelen misafirleri kibar karşılamak; sarımsak soymak\n• Sabah şoföre mal yüklemede yardımcı olmak\n• Akşam/sabah gelen ciroları teslim alıp Ramazan Bey'e, yoksa muhasebeye teslim etmek",
    "gorevlerHaftalik": "• Camları haftada bir silmek, tavan örümcek ağlarını temizlemek\n• Bardakları haftada bir çamaşır suyuyla yıkamak\n• Kargo yapacak kimse yoksa o gün kargoları yapmak",
    "gorevlerAylik": "",
    "sorumluluklar": "• Görev yerini talep olmadan terk etmemek\n• Sigara ile iş yapmamak\n• Personelle gereksiz muhabbetten kaçınmak",
    "yetkiler": "",
    "ozellikler": "• Müşteri odaklılık, temizlik/düzen disiplini",
    "kpiSeti": "1. Günlük ciro teslim zamanlaması ve eksiksizliği → %100 | Ciro teslim tutanağı | Günlük\n2. Dükkan hijyen/düzen denetim puanı → ≥ 90/100 | Denetim formu | Haftalık\n3. Sayım tutarlılığı (fire oranı) → ≤ %1 | Sayım kaydı | Günlük",
    "raporlama": "• Günlük Ciro Teslim Formu → Günlük → Ramazan ALTUĞ / Muhasebe Sorumlusu\n• Haftalık Sayım ve Fire Raporu → Haftalık → Gıda Mühendisi / Muhasebe Sorumlusu",
    "primBaglantisi": "• Tutar (Ciro) Primi — merkez şube bileşeni\n• Yemek Yardımı"
  }
];

export const VARSAYILAN_PRIM_AYARLARI: PrimAyarlari = {
  "merkez_taban_kg": 10000,
  "bolge1_taban_kg": 20000,
  "bolge2_taban_kg": 20000,
  "merkez_sube_hedef_kg": 400,
  "bolge1_sube_hedef_kg": 220,
  "bolge2_sube_hedef_kg": 300,
  "uretim_katsayi_tl": 1,
  "merkez_katsayi_tl": 1,
  "bolge_katsayi_tl": 2,
  "uretim_dagilim": {
    "merkez": 0.7,
    "bolge": 0.2,
    "uretim": 0.1
  },
  "merkez_dagilim": {
    "uretim": 0.7,
    "bolge": 0.2,
    "merkez": 0.1
  },
  "bolge_dagilim": {
    "sorumlu": 0.7,
    "merkez": 0.2,
    "uretim": 0.1
  },
  "personel_uretim": [
    {
      "ad": "Tuğçe MOLLAOĞLU",
      "unvan": "Gıda Mühendisi"
    },
    {
      "ad": "Feras BEY",
      "unvan": "Usta Başı"
    },
    {
      "ad": "Hossam ALRAJAB",
      "unvan": "Üretim Personeli"
    },
    {
      "ad": "Muhammed ABDULLAH",
      "unvan": "Üretim Personeli"
    },
    {
      "ad": "Ahmet SARI",
      "unvan": "Sos Üretim Personeli"
    }
  ],
  "personel_merkez": [
    {
      "ad": "Gamze DAĞ",
      "unvan": "Muhasebe Sorumlusu"
    },
    {
      "ad": "Ümran BALCI",
      "unvan": "Sipariş Birimi Yetkilisi"
    },
    {
      "ad": "Hüseyin AKİ",
      "unvan": "Depo ve Genel İşler Sorumlusu"
    },
    {
      "ad": "Bayram ERTÜM",
      "unvan": "Sevkiyat Sorumlusu"
    },
    {
      "ad": "Cemil HALLAÇ",
      "unvan": "Sevkiyat Sorumlusu"
    },
    {
      "ad": "Elif TUNCA",
      "unvan": "Ofis Destek Elemanı"
    }
  ],
  "bolge1_ad": "Metin BAŞOK",
  "bolge1_unvan": "Franchise Bölge Sorumlusu (Bölge 1)",
  "bolge2_ad": "Umut Can DOĞAN",
  "bolge2_unvan": "Franchise Bölge Sorumlusu (Bölge 2)",
  "merkez_sorumlu_ad": "İzzet ALTUĞ",
  "merkez_sorumlu_unvan": "Merkez Şubeler Sorumlusu",
  "acilis_ceyrek_tl": 4500,
  "acilis_yarim_tl": 7000,
  "acilis_tam_tl": 10000,
  "donusum_tl": 4500,
  "yemek_gunluk_tl": 330,
  "yemek_calisma_gunu": 22,
  "harcirah_sehir_ici_tl": 0,
  "harcirah_sehir_disi_tl": 0,
  "harcirah_gecelemeli_tl": 0
};
