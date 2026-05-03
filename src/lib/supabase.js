import { createClient } from "@supabase/supabase-js";

const url =
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || "";
const key =
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";

let client;

/**
 * Supabase browser client for Storage uploads. Returns null if URL or anon key are missing.
 */
export function getSupabase() {
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

/** Must match an existing bucket in Supabase → Storage (default: "avatars"). */
export function getAvatarsBucket() {
  const fromEnv =
    import.meta.env.NEXT_PUBLIC_SUPABASE_AVATARS_BUCKET ||
    import.meta.env.VITE_SUPABASE_AVATARS_BUCKET ||
    "";
  const name = String(fromEnv).trim();
  return name || "avatars";
}
