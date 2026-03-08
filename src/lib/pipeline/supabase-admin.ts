import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy-initialized server-side Supabase client with service role key.
 *
 * Uses a getter so the client is only created on first access (at request
 * time), not at module load time — which would crash `next build` when
 * env vars aren't present. Fails fast with a descriptive error instead of
 * creating a zombie client. (OWASP A05:2021 Security Misconfiguration)
 */
let _client: SupabaseClient | null = null;

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    if (!_client) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!url || !key) {
        throw new Error(
          "[supabase-admin] Missing required env vars: " +
            [!url && "NEXT_PUBLIC_SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"]
              .filter(Boolean)
              .join(", ")
        );
      }

      _client = createClient(url, key);
    }

    return Reflect.get(_client, prop, receiver);
  },
});
