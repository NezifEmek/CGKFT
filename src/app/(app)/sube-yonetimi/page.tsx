import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Sube } from "@/types/database";
import { SubeEditor } from "./sube-editor";

export default async function SubeYonetimiSayfasi() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: subeler } = await supabase
    .from("subeler")
    .select("*")
    .order("bolge")
    .order("ad")
    .returns<Sube[]>();

  const liste = subeler ?? [];
  const bolgeler = [...new Set(liste.map((s) => s.bolge).filter(Boolean))].sort();

  if (profile.rol === "denetmen") {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">Şube Yönetimi</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Bu ekran Denetmen rolüne kapalıdır. Şube bilgilerini <b>Şubeler</b> ekranından
          görüntüleyebilirsiniz.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold mb-1">Şube Yönetimi</h1>
        <p className="text-sm text-neutral-500">
          Soldaki listeden bir şube seçip düzenleyin ya da sağdaki formla yeni şube ekleyin.
        </p>
      </div>

      <SubeEditor
        subeler={liste}
        bolgeler={bolgeler}
        kilitliBolge={profile.rol === "bolge_muduru" ? profile.bolge : null}
        silebilir={profile.rol === "admin" || profile.rol === "genel_mudur"}
      />
    </div>
  );
}
