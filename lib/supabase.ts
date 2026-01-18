/**
 * Re-export the Supabase client from the new location.
 * This maintains backwards compatibility with existing imports.
 *
 * For new code, prefer importing from:
 * - Client Components: import { supabase } from "@/lib/supabase/client"
 * - Server Components: import { createClient } from "@/lib/supabase/server"
 */
export { supabase, createClient } from "./supabase/client";
