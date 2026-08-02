"use client";

/**
 * Yazdır / PDF düğmesi.
 *
 * Ayrı bir PDF kütüphanesi kurulmadı: tarayıcının kendi yazdırma penceresi
 * kullanılıyor ve oradan "PDF olarak kaydet" seçiliyor. Böylece çıktı ekranda
 * görünenle birebir aynı oluyor; Türkçe karakter, yazı tipi gömme ve sayfa
 * boyutu gibi dertler hiç doğmuyor. Sayfa düzenini globals.css'teki
 * @media print bloğu hazırlıyor.
 */
export function YazdirDugmesi({
  etiket = "🖨 Yazdır / PDF",
  baslik,
}: {
  etiket?: string;
  /** Verilirse yazdırma sırasında sayfa başlığı (PDF dosya adı) bu olur. */
  baslik?: string;
}) {
  function yazdir() {
    if (!baslik) {
      window.print();
      return;
    }
    // Tarayıcı PDF dosya adını sekme başlığından alır; geçici olarak
    // değiştirip sonra geri koyuyoruz.
    const eski = document.title;
    document.title = baslik;
    window.print();
    // Yazdırma penceresi kapandıktan sonra eski başlık geri gelsin.
    setTimeout(() => {
      document.title = eski;
    }, 500);
  }

  return (
    <button
      type="button"
      onClick={yazdir}
      className="yazdirma-gizle rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm"
    >
      {etiket}
    </button>
  );
}
