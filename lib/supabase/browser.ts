import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

export function createClient() {
  const { url, key } = getPublicEnv();
  return createBrowserClient(url, key);
}
