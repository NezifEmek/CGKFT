import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Dosya ekleri server action ile yükleniyor. Varsayılan sınır 1 MB;
      // 25 MB'lık kova sınırının üstüne biraz pay bırakıyoruz, yoksa
      // sınıra yakın dosyalar Storage'a hiç ulaşmadan reddedilirdi.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
