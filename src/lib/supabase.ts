import { createClient } from "@supabase/supabase-js";

// Client serveur uniquement (service_role) : ne jamais importer depuis un composant client.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
