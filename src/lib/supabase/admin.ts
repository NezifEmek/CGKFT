import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// SADECE server tarafında (route handler / server action) kullanılır.
// service_role anahtarı RLS'i atlar — asla tarayıcıya/istemci koduna sızmamalı.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
