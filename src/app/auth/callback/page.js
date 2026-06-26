'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function Spinner() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ animation: 'spin 0.9s linear infinite' }}>
      <circle cx="22" cy="22" r="18" stroke="#FF5A5F" strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray="90 30" />
    </svg>
  );
}

function CallbackHandler({ setStatus, setErrMsg }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let active = true;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const syncCode = searchParams.get('sync_code');
    const authType = searchParams.get('type');

    if (error) {
      setStatus('error');
      setErrMsg(errorDescription || error);
      setTimeout(() => {
        if (active) {
          router.replace(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`);
        }
      }, 2500);
      return;
    }

    const timeout = (ms) => new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Sign-in verification timed out. Please try again.')), ms)
    );

    const runAuthFlow = async () => {
      try {
        // Check for existing session first
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          timeout(8000)
        ]);

        let session = sessionResult?.data?.session;

        if (!session && code) {
          // Exchange code for session
          const exchangeResult = await Promise.race([
            supabase.auth.exchangeCodeForSession(code),
            timeout(15000)
          ]);

          if (exchangeResult?.error) throw exchangeResult.error;
          session = exchangeResult?.data?.session;
        }

        if (!session) {
          throw new Error('No session found. Please try signing in again.');
        }

        if (active) {
          setStatus('success');

          // If this was a sync_code flow (from WebView), write session back to DB and close
          if (syncCode) {
            try {
              await supabase.from('app_settings').upsert({
                key: `auth_sync_${syncCode}`,
                value: {
                  status: 'completed',
                  session: {
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                  },
                  completedAt: Date.now()
                }
              }, { onConflict: 'key' });
            } catch (syncErr) {
              console.error('[Auth Callback] Sync write error:', syncErr);
            }
            // Show close message — the WebView will pick up the session via polling
            setStatus('sync_done');
            return;
          }

          // If this is a password recovery flow, redirect to login with recovery flag
          if (authType === 'recovery') {
            setTimeout(() => {
              if (active) router.replace('/auth/login?recovery=true');
            }, 800);
            return;
          }

          // Check if user needs onboarding (Google OAuth users without profile data)
          let profileIncomplete = true;
          if (session?.user?.id) {
            try {
              const { data: profile, error: profileErr } = await supabase
                .from('users')
                .select('gender, looking_for, age')
                .eq('id', session.user.id)
                .single();

              if (!profileErr && profile) {
                profileIncomplete = !profile.gender || !profile.looking_for || !profile.age;
              } else {
                const meta = session.user.user_metadata || {};
                profileIncomplete = !meta.gender || !meta.looking_for;
              }
            } catch (err) {
              const meta = session.user.user_metadata || {};
              profileIncomplete = !meta.gender || !meta.looking_for;
            }
          }

          const nextUrl = profileIncomplete ? '/onboarding' : '/discover';

          setTimeout(() => {
            if (active) {
              router.replace(nextUrl);
            }
          }, 800);
        }
      } catch (err) {
        console.error('[Auth Callback] Auth flow error:', err);
        if (active) {
          setStatus('error');
          setErrMsg(err.message || 'Authentication failed. Please try again.');
          setTimeout(() => {
            if (active) {
              router.replace(`/auth/login?error=${encodeURIComponent(err.message || 'Authentication failed')}`);
            }
          }, 3000);
        }
      }
    };

    runAuthFlow();

    return () => { active = false; };
  }, [searchParams, router, setStatus, setErrMsg]);

  return null;
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState('loading');
  const [errMsg, setErrMsg] = useState('');
  const router = useRouter();

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .cb-fadeup { animation: fadeUp 0.4s ease both; }
      `}</style>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg, #FFFFFF)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: '24px',
      }}>
        {/* Logo — dark text for light mode, light text for dark mode */}
        <img
          src="/gs-logo.png?v=7"
          alt="GS"
          style={{ width: '72px', height: '72px', objectFit: 'contain', marginBottom: '32px' }}
          className="cb-fadeup"
        />

        {status === 'loading' && (
          <div className="cb-fadeup" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <Spinner />
            <p style={{ color: 'var(--color-text-secondary, #495057)', fontSize: '15px', fontWeight: '500', margin: 0 }}>
              Completing sign-in…
            </p>
            <p style={{ color: 'var(--color-text-muted, #868E96)', fontSize: '13px', margin: 0, textAlign: 'center' }}>
              Please wait while we verify your account
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="cb-fadeup" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="26" fill="#37B24D" fillOpacity="0.12" />
              <circle cx="26" cy="26" r="20" fill="#37B24D" />
              <path d="M17 26L23 32L35 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p style={{ color: 'var(--color-text-primary, #1A1919)', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              Signed in successfully!
            </p>
            <p style={{ color: 'var(--color-text-muted, #868E96)', fontSize: '13px', margin: 0 }}>
              Taking you to the app…
            </p>
          </div>
        )}

        {status === 'sync_done' && (
          <div className="cb-fadeup" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="26" fill="#37B24D" fillOpacity="0.12" />
              <circle cx="26" cy="26" r="20" fill="#37B24D" />
              <path d="M17 26L23 32L35 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p style={{ color: 'var(--color-text-primary, #1A1919)', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              Login complete!
            </p>
            <p style={{ color: 'var(--color-text-muted, #868E96)', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
              You can close this tab and return to the app. Your session will be synced automatically.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="cb-fadeup" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '300px' }}>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="26" fill="#FA5252" fillOpacity="0.12" />
              <circle cx="26" cy="26" r="20" fill="#FA5252" />
              <path d="M26 17V27" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="26" cy="33" r="1.5" fill="white" />
            </svg>
            <p style={{ color: 'var(--color-text-primary, #1A1919)', fontSize: '16px', fontWeight: '600', margin: 0, textAlign: 'center' }}>
              Sign-in failed
            </p>
            <p style={{ color: 'var(--color-text-muted, #868E96)', fontSize: '13px', margin: 0, textAlign: 'center', lineHeight: '1.5' }}>
              {errMsg || 'Something went wrong. Redirecting to login…'}
            </p>
            <button
              onClick={() => router.replace('/auth/login')}
              style={{
                marginTop: '8px',
                background: 'linear-gradient(135deg, #FF5A5F 0%, #FF2A6D 100%)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '700',
                padding: '12px 24px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(255,90,95,0.3)',
              }}
            >
              Try Again
            </button>
          </div>
        )}

        <Suspense fallback={null}>
          <CallbackHandler setStatus={setStatus} setErrMsg={setErrMsg} />
        </Suspense>
      </div>
    </>
  );
}
