import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL as string;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Service-role client: bypasses RLS. Server-only — never import under src/.
export const admin = createClient(url, key, { auth: { persistSession: false } });
