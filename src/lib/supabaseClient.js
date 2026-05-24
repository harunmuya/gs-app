import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Auth features will be unavailable.');
}

/**
 * Custom storage adapter that writes to BOTH localStorage AND sessionStorage.
 * This is critical for mobile WebViews and cross-context OAuth (PKCE flow):
 * - Some WebViews lose localStorage between redirects → sessionStorage catches it
 * - Some browsers restrict sessionStorage cross-origin → localStorage catches it
 * Reads prefer localStorage, then fall back to sessionStorage.
 */
const dualStorage = typeof window !== 'undefined'
  ? {
      getItem: (key) => {
        try {
          return localStorage.getItem(key) ?? sessionStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        try { localStorage.setItem(key, value); } catch {}
        try { sessionStorage.setItem(key, value); } catch {}
      },
      removeItem: (key) => {
        try { localStorage.removeItem(key); } catch {}
        try { sessionStorage.removeItem(key); } catch {}
      },
    }
  : undefined;

// Using @supabase/ssr createBrowserClient with:
// - auth.flowType: 'pkce' (explicit, secure)
// - auth.storage: dualStorage (resilient to WebView context loss)
// - cookieOptions.path: '/' (global cookie visibility)
export const supabase = createBrowserClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      flowType: 'pkce',
      ...(dualStorage ? { storage: dualStorage } : {}),
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
    cookieOptions: {
      path: '/',
      sameSite: 'lax',
      secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
    },
  }
);

export default supabase;
