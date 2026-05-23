import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Auth features will be unavailable.');
}

// Using @supabase/ssr's createBrowserClient instead of createClient.
// This stores auth tokens AND the PKCE code_verifier in cookies (not localStorage),
// so the server-side /auth/callback route can read them during OAuth code exchange.
export const supabase = createBrowserClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

export default supabase;
