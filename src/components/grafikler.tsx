"use client";

// Eski paneldeki Chart.js grafiklerinin karşılıkları. Sunucu bileşenleri
// buraya yalnızca düz veri (sayı/metin dizileri) geçirir; Chart.js yapılandırması
// ve tooltip fonksiyonları istemci tarafında burada kurulur.

import { useEffect, useRef } from "react";
import type { Chart as ChartTipi, ChartConfiguration } from "chart.js";

const RENK = {
  ana: "#c0392b",
  anaSolgun: "rgba(192, 57, 43, 0.28)",
  amber: "#f59e0b",
  mavi: "#2563eb",
  cizgi: "rgba(128, 137, 155, 0.22)",
  metin: "rgba(128, 137, 155, 1)",
};

const sayiFmt = new Intl.NumberFormat("tr-TR");
const ondalikFmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

/** Chart.js'i yalnızca tarayıcıda yükleyip canvas'a bağlar, unmount'ta yok eder. */
function useChart(config: ChartConfiguration) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // config her render'da yeni nesne olur; grafiği yalnızca veri değişince
  // yeniden kurmak için JSON imzasını bağımlılık olarak kullanıyoruz.
  const imza = JSON.stringify(config.data);

  useEffect(() => {
    let chart: ChartTipi | undefined;
    let iptal = false;

    (async () => {
      try {
        const { Chart, registerables } = await import("chart.js");
        Chart.register(...registerables);
        if (iptal || !canvasRef.current) return;
        chart = new Chart(canvasRef.current, config);
      } catch (err) {
        console.error("Grafik çizilemedi:", err);
      }
    })();

    return () => {
      iptal = true;
      chart?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imza]);

  return canvasRef;
}

function Tuval({ config, yukseklik }: { config: ChartConfiguration; yukseklik: number }) {
  const ref = useChart(config);
  return (
    <div style={{ height: yukseklik }} className="relative">
      <canvas ref={ref} />
    </div>
  );
}

const ORTAK_EKSEN = {
  grid: { color: RENK.cizgi },
  ticks: { color: RENK.metin, font: { size: 11 } },
  border: { display: false },
};

/**
 * Aylık satış trendi: iki yılın kg sütunları + sağ eksende kg/gün çizgisi.
 * (Eski paneldeki "Aylık Satış Trendi" grafiği.)
 */
export function AylikTrendGrafik({
  aylar,
  cari,
  onceki,
  gunlukOrt,
  cariYil,
  oncekiYil,
  yukseklik = 300,
}: {
  aylar: string[];
  cari: number[];
  onceki: number[];
  gunlukOrt: number[];
  cariYil: number;
  oncekiYil: number;
  yukseklik?: number;
}) {
  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: aylar,
      datasets: [
        {
          type: "line",
          label: "Günlük ort. (kg/gün)",
          data: gunlukOrt,
          borderColor: RENK.amber,
          backgroundColor: RENK.amber,
          pointBackgroundColor: "#fff",
          pointBorderColor: RENK.amber,
          pointBorderWidth: 2,
          pointRadius: 4,
          borderWidth: 2,
          tension: 0.35,
          yAxisID: "y2",
          order: 0,
        },
        {
          type: "bar",
          label: `${oncekiYil} (kg)`,
          data: onceki,
          backgroundColor: RENK.anaSolgun,
          borderRadius: 3,
          order: 2,
        },
        {
          type: "bar",
          label: `${cariYil} (kg)`,
          data: cari,
          backgroundColor: RENK.ana,
          borderRadius: 3,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Animasyon kapalı: 5 grafik aynı anda çizildiğinde daha hızlı ve
      // requestAnimationFrame'in çalışmadığı ortamlarda boş kalmıyor.
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", labels: { color: RENK.metin, boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = Number(ctx.parsed.y) || 0;
              return ctx.dataset.yAxisID === "y2"
                ? `${ctx.dataset.label}: ${ondalikFmt.format(d)}`
                : `${ctx.dataset.label}: ${sayiFmt.format(Math.round(d))} kg`;
            },
          },
        },
      },
      scales: {
        x: ORTAK_EKSEN,
        y: {
          ...ORTAK_EKSEN,
          position: "left",
          title: { display: true, text: "kg", color: RENK.metin, font: { size: 11 } },
          ticks: { ...ORTAK_EKSEN.ticks, callback: (v) => sayiFmt.format(Number(v)) },
        },
        y2: {
          position: "right",
          grid: { drawOnChartArea: false },
          border: { display: false },
          title: { display: true, text: "kg/gün", color: RENK.metin, font: { size: 11 } },
          ticks: { color: RENK.metin, font: { size: 11 } },
        },
      },
    },
  };

  return <Tuval config={config} yukseklik={yukseklik} />;
}

/** Merkez (MŞ) ve Franchise (FR) aylık kg karşılaştırması — çizgi grafik. */
export function MerkezFranchiseGrafik({
  aylar,
  merkez,
  franchise,
  yukseklik = 260,
}: {
  aylar: string[];
  merkez: number[];
  franchise: number[];
  yukseklik?: number;
}) {
  const config: ChartConfiguration = {
    type: "line",
    data: {
      labels: aylar,
      datasets: [
        {
          label: "Merkez (MŞ)",
          data: merkez,
          borderColor: RENK.ana,
          backgroundColor: RENK.ana,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.3,
        },
        {
          label: "Franchise (FR)",
          data: franchise,
          borderColor: RENK.mavi,
          backgroundColor: RENK.mavi,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Animasyon kapalı: 5 grafik aynı anda çizildiğinde daha hızlı ve
      // requestAnimationFrame'in çalışmadığı ortamlarda boş kalmıyor.
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", labels: { color: RENK.metin, boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${sayiFmt.format(Math.round(Number(ctx.parsed.y) || 0))} kg`,
          },
        },
      },
      scales: {
        x: ORTAK_EKSEN,
        y: {
          ...ORTAK_EKSEN,
          ticks: { ...ORTAK_EKSEN.ticks, callback: (v) => sayiFmt.format(Number(v)) },
        },
      },
    },
  };

  return <Tuval config={config} yukseklik={yukseklik} />;
}

/** Segment dağılımı — halka (donut) grafik. */
export function SegmentDonut({
  etiketler,
  adetler,
  renkler,
  yukseklik = 260,
}: {
  etiketler: string[];
  adetler: number[];
  renkler: string[];
  yukseklik?: number;
}) {
  const config: ChartConfiguration = {
    type: "doughnut",
    data: {
      labels: etiketler,
      datasets: [{ data: adetler, backgroundColor: renkler, borderWidth: 0, hoverOffset: 6 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Animasyon kapalı: 5 grafik aynı anda çizildiğinde daha hızlı ve
      // requestAnimationFrame'in çalışmadığı ortamlarda boş kalmıyor.
      animation: false,
      cutout: "62%",
      plugins: {
        legend: { position: "right", labels: { color: RENK.metin, boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const toplam = (ctx.dataset.data as number[]).reduce((t, v) => t + (Number(v) || 0), 0) || 1;
              const d = Number(ctx.parsed) || 0;
              return `${ctx.label}: ${d} şube (%${((d / toplam) * 100).toFixed(1)})`;
            },
          },
        },
      },
    },
  };

  return <Tuval config={config} yukseklik={yukseklik} />;
}

/** Yatay çubuk — bölge / il kırılımı gibi sıralı listeler için. */
export function YatayCubukGrafik({
  etiketler,
  degerler,
  renk = RENK.ana,
  yukseklik = 260,
}: {
  etiketler: string[];
  degerler: number[];
  renk?: string;
  yukseklik?: number;
}) {
  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: etiketler,
      datasets: [{ label: "kg", data: degerler, backgroundColor: renk, borderRadius: 3 }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      // Animasyon kapalı: 5 grafik aynı anda çizildiğinde daha hızlı ve
      // requestAnimationFrame'in çalışmadığı ortamlarda boş kalmıyor.
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${sayiFmt.format(Math.round(Number(ctx.parsed.x) || 0))} kg`,
          },
        },
      },
      scales: {
        x: {
          ...ORTAK_EKSEN,
          ticks: { ...ORTAK_EKSEN.ticks, callback: (v) => sayiFmt.format(Number(v)) },
        },
        y: ORTAK_EKSEN,
      },
    },
  };

  return <Tuval config={config} yukseklik={yukseklik} />;
}
