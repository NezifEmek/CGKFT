"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface MenuOgesi {
  href: string;
  etiket: string;
}

/** Eski paneldeki koyu yan menü — aktif satır marka kırmızısıyla vurgulanır. */
export function YanMenuLinkleri({ ogeler }: { ogeler: MenuOgesi[] }) {
  const yol = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
      {ogeler.map((m) => {
        const aktif = m.href === "/" ? yol === "/" : yol.startsWith(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            className="block rounded-lg px-3 py-2 text-[13px] transition-colors"
            style={
              aktif
                ? { background: "#c0392b", color: "#fff", fontWeight: 600 }
                : { color: "#c7ccd6" }
            }
          >
            {m.etiket}
          </Link>
        );
      })}
    </nav>
  );
}
