'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Animated spinner SVG — no external deps
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
        if (active) router.replace(`/auth/login?error=${encodeURIComponent(errorDescription || error)}`);
      }, 2500);
      return;
    }

    const timeout = (ms) => new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Sign-in verification timed out. Please try again.')), ms)
    );

    const runAuthFlow = async () => {
      try {
        // Pre-check: session may already exist (e.g. page reload) with 6s timeout
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          timeout(6000)
        ]);

        if (sessionResult?.data?.session) {
          if (active) {
            setStatus('success');
            setTimeout(() => {
              if (active) router.replace('/discover');
            }, 600);
          }
          return;
        }

        if (code) {
          // Exchange code with 12s timeout
          const exchangeResult = await Promise.race([
            supabase.auth.exchangeCodeForSession(code),
            timeout(12000)
          ]);

          if (exchangeResult?.error) {
            throw exchangeResult.error;
          }

          if (active) {
            setStatus('success');
            setTimeout(() => {
              if (active) router.replace('/discover');
            }, 600);
          }
        } else {
          if (active) router.replace('/discover');
        }
      } catch (err) {
        console.error('[Auth Callback] Auth flow error:', err);
        if (active) {
          setStatus('error');
          setErrMsg(err.message || 'Authentication failed. Please try again.');
          setTimeout(() => {
            if (active) router.replace(`/auth/login?error=${encodeURIComponent(err.message || 'Authentication failed')}`);
          }, 2500);
        }
      }
    };

    runAuthFlow();

    return () => {
      active = false;
    };
  }, [searchParams, router, setStatus, setErrMsg]);

  return null;
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
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
        background: '#FFFFFF',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: '24px',
        gap: '0',
      }}>
        {/* Logo */}
        <img
          src="/genuine-logo.png"
          alt="Genuine Sugarmummies"
          style={{ height: '40px', objectFit: 'contain', marginBottom: '36px' }}
          className="cb-fadeup"
        />

        {status === 'loading' && (
          <div className="cb-fadeup" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <Spinner />
            <p style={{ color: '#495057', fontSize: '15px', fontWeight: '500', margin: 0 }}>
              Completing sign-in…
            </p>
            <p style={{ color: '#868E96', fontSize: '13px', margin: 0, textAlign: 'center' }}>
              Please wait, verifying your account
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="cb-fadeup" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            {/* Green check circle */}
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="26" fill="#37B24D" fillOpacity="0.12" />
              <circle cx="26" cy="26" r="20" fill="#37B24D" />
              <path d="M17 26L23 32L35 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p style={{ color: '#1A1919', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              Signed in successfully!
            </p>
            <p style={{ color: '#868E96', fontSize: '13px', margin: 0 }}>
              Taking you to the app…
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="cb-fadeup" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '300px' }}>
            {/* Red warning circle */}
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="26" fill="#FA5252" fillOpacity="0.12" />
              <circle cx="26" cy="26" r="20" fill="#FA5252" />
              <path d="M26 17V27" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="26" cy="33" r="1.5" fill="white" />
            </svg>
            <p style={{ color: '#1A1919', fontSize: '16px', fontWeight: '600', margin: 0, textAlign: 'center' }}>
              Sign-in failed
            </p>
            <p style={{ color: '#868E96', fontSize: '13px', margin: 0, textAlign: 'center', lineHeight: '1.5' }}>
              {errMsg || 'Something went wrong. Redirecting to login…'}
            </p>
            <p style={{ color: '#ADB5BD', fontSize: '12px', margin: 0 }}>
              Redirecting you back…
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
