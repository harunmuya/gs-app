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

    if (error) {
      setStatus('error');
      setErrMsg(errorDescription || error);
      setTimeout(() => {
        if (active) {
          if (window.opener) {
            window.opener.postMessage({ type: 'auth-error', error: errorDescription || error }, window.location.origin);
            window.close();
          } else {
            try {
              window.location.href = 'gonative://browser/close';
            } catch (e) {}
            router.replace(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`);
          }
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
          timeout(6000)
        ]);

        let session = sessionResult?.data?.session;

        if (!session && code) {
          // Exchange code for session
          const exchangeResult = await Promise.race([
            supabase.auth.exchangeCodeForSession(code),
            timeout(12000)
          ]);

          if (exchangeResult?.error) throw exchangeResult.error;
          session = exchangeResult?.data?.session;
        }

        if (active) {
          const syncCode = searchParams.get('sync_code');
          if (syncCode) {
            try {
              await supabase.from('app_settings')
                .update({
                  value: {
                    status: 'completed',
                    session: {
                      access_token: session.access_token,
                      refresh_token: session.refresh_token,
                    },
                    createdAt: Date.now()
                  }
                })
                .eq('key', `auth_sync_${syncCode}`);
              setStatus('synced');
              // Automatically close the popup window after a brief delay so the user is returned to the app
              setTimeout(() => {
                if (active) {
                  // 1. Try GoNative/Median JS Bridge commands if present
                  try {
                    if (window.gonative && window.gonative.browser && typeof window.gonative.browser.close === 'function') {
                      window.gonative.browser.close();
                    } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.gonative) {
                      window.webkit.messageHandlers.gonative.postMessage({ browser: { close: true } });
                    }
                  } catch (e) {
                    console.warn('[GoNative Bridge Close Error]', e);
                  }

                  // 2. Try closing via custom URL schemes (intercepted by WebView client)
                  try {
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = 'gonative://browser/close';
                    document.body.appendChild(iframe);
                    setTimeout(() => iframe.remove(), 500);
                  } catch (e) {
                    window.location.href = 'gonative://browser/close';
                  }

                  // 3. Standard window.close fallback
                  window.close();
                }
              }, 1500);
            } catch (syncErr) {
              console.error('[Auth Callback] Failed to write sync session:', syncErr);
              setStatus('error');
              setErrMsg('Failed to link session back to the app.');
            }
            return;
          }

          setStatus('success');

          // Check if user needs onboarding (Google OAuth users without profile data)
          const needsOnboarding = session?.user && (
            !session.user.user_metadata?.gender &&
            !session.user.user_metadata?.looking_for
          );

          // Check users table with error shielding
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
              if (window.opener) {
                window.opener.postMessage({ type: 'auth-success', nextUrl }, window.location.origin);
                window.close();
              } else {
                router.replace(nextUrl);
              }
            }
          }, 600);
        }
      } catch (err) {
        console.error('[Auth Callback] Auth flow error:', err);
        if (active) {
          setStatus('error');
          setErrMsg(err.message || 'Authentication failed. Please try again.');
          setTimeout(() => {
            if (active) {
              if (window.opener) {
                window.opener.postMessage({ type: 'auth-error', error: err.message || 'Authentication failed' }, window.location.origin);
                window.close();
              } else {
                try {
                  window.location.href = 'gonative://browser/close';
                } catch (e) {}
                router.replace(`/auth/login?error=${encodeURIComponent(err.message || 'Authentication failed')}`);
              }
            }
          }, 2500);
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
        {/* Logo */}
        <img
          src="/genuine-logo.png"
          alt="Genuine Sugarmummies"
          style={{ height: '36px', objectFit: 'contain', marginBottom: '32px' }}
          className="cb-fadeup dark:hidden"
        />
        <img
          src="/genuine-logo-alt.png"
          alt="Genuine Sugarmummies"
          style={{ height: '36px', objectFit: 'contain', marginBottom: '32px' }}
          className="cb-fadeup hidden dark:block"
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

        {status === 'synced' && (
          <div className="cb-fadeup" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="26" fill="#37B24D" fillOpacity="0.12" />
              <circle cx="26" cy="26" r="20" fill="#37B24D" />
              <path d="M17 26L23 32L35 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p style={{ color: 'var(--color-text-primary, #1A1919)', fontSize: '18px', fontWeight: '700', margin: 0 }}>
              Device Synced Successfully!
            </p>
            <p style={{ color: 'var(--color-text-secondary, #495057)', fontSize: '14px', margin: '4px 0 0 0', lineHeight: '1.5', maxWidth: '280px' }}>
              You are now logged in inside the GS mobile application.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
              <a href="gonative://browser/close" style={{ display: 'inline-block', background: 'linear-gradient(135deg, #FF5A5F 0%, #FF2A6D 100%)', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', padding: '12px 24px', borderRadius: '14px', textDecoration: 'none', boxShadow: '0 4px 15px rgba(255,90,95,0.3)', outline: 'none' }}>
                Return to Application
              </a>
              <p style={{ color: 'var(--color-text-muted, #868E96)', fontSize: '11px', margin: '4px 0 0 0' }}>
                If you aren't returned automatically, click the button above.
              </p>
            </div>
            
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
            `}</style>
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
          </div>
        )}

        <Suspense fallback={null}>
          <CallbackHandler setStatus={setStatus} setErrMsg={setErrMsg} />
        </Suspense>
      </div>
    </>
  );
}
