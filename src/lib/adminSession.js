import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { verifyPassword } from '@/lib/security';

/**
 * Admin authentication.
 *
 * Replaces the previous scheme, where the "token" was `base64(email:password)` —
 * reversible, non-expiring, and stored in localStorage, so anyone who obtained a
 * token recovered the live admin password. Tokens here are HMAC-signed, carry an
 * expiry, and are transported in an httpOnly cookie that JavaScript cannot read.
 *
 * There is deliberately no default password. If the environment is not configured,
 * admin login fails closed rather than falling back to a value published in source.
 */

export const ADMIN_COOKIE = 'gs_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function base64url(input) {
    return Buffer.from(input).toString('base64url');
}

/**
 * Signing key for admin sessions.
 *
 * Prefers a dedicated ADMIN_SESSION_SECRET. Falls back to a hash of the service
 * role key so an existing deployment does not lose admin access the moment this
 * ships — the fallback is still a strong server-only secret, but rotating admin
 * sessions independently requires setting ADMIN_SESSION_SECRET.
 */
function signingKey() {
    const explicit = process.env.ADMIN_SESSION_SECRET || '';
    if (explicit.length >= 16) return explicit;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (serviceKey.length >= 16) {
        return createHash('sha256').update(`gs-admin-session:${serviceKey}`).digest('hex');
    }
    return '';
}

/** True when admin login is possible at all. */
export function adminAuthConfigured() {
    const hasIdentity = Boolean(process.env.ADMIN_EMAIL);
    const hasSecret = Boolean(process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD);
    return Boolean(hasIdentity && hasSecret && signingKey());
}

function safeEqual(a, b) {
    const bufA = Buffer.from(String(a || ''), 'utf8');
    const bufB = Buffer.from(String(b || ''), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}

/**
 * Verify submitted admin credentials.
 *
 * ADMIN_PASSWORD_HASH (scrypt, as produced by lib/security#hashPassword) is
 * preferred so the plaintext password never sits in the environment. ADMIN_PASSWORD
 * remains supported for continuity.
 */
export function verifyAdminCredentials(email, password) {
    if (!adminAuthConfigured()) return false;

    const submittedEmail = String(email || '').trim().toLowerCase();
    const expectedEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!safeEqual(submittedEmail, expectedEmail)) return false;

    const hash = process.env.ADMIN_PASSWORD_HASH || '';
    if (hash) return verifyPassword(password, hash);

    return safeEqual(String(password || ''), String(process.env.ADMIN_PASSWORD || ''));
}

/** Mint a signed, expiring admin session token. */
export function issueAdminSession() {
    const key = signingKey();
    if (!key) return null;

    const payload = {
        sub: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
        jti: randomUUID(),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    };
    const body = base64url(JSON.stringify(payload));
    const signature = createHmac('sha256', key).update(body).digest('base64url');
    return { token: `${body}.${signature}`, maxAge: SESSION_TTL_SECONDS };
}

/** Verify a token's signature and expiry. Returns the payload, or null. */
export function verifyAdminSession(token) {
    const key = signingKey();
    if (!key || !token) return null;

    const [body, signature] = String(token).split('.');
    if (!body || !signature) return null;

    const expected = createHmac('sha256', key).update(body).digest('base64url');
    if (!safeEqual(signature, expected)) return null;

    let payload;
    try {
        payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
        return null;
    }

    if (!payload?.exp || Math.floor(Date.now() / 1000) >= Number(payload.exp)) return null;

    // Reject sessions minted for a different admin identity than the one now configured,
    // so changing ADMIN_EMAIL immediately invalidates outstanding sessions.
    const expectedSub = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!expectedSub || payload.sub !== expectedSub) return null;

    return payload;
}

/** Read and verify the admin session from a request's cookies. */
export function adminSessionFromRequest(request) {
    const cookieToken = request.cookies?.get?.(ADMIN_COOKIE)?.value || '';
    return verifyAdminSession(cookieToken);
}

export function adminCookieOptions(maxAge) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
    };
}

/**
 * Login throttle.
 *
 * Per-instance and in-memory, so it is not a substitute for a shared rate limiter
 * on a multi-instance deployment — it raises the cost of online password guessing
 * against a single warm function instance. Move to a durable store (Supabase table
 * or Upstash) if admin login is ever exposed to untrusted traffic at volume.
 */
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export function loginThrottled(identifier) {
    const key = String(identifier || 'unknown');
    const now = Date.now();
    const record = attempts.get(key);
    if (!record || now - record.first > WINDOW_MS) return false;
    return record.count >= MAX_ATTEMPTS;
}

export function recordLoginFailure(identifier) {
    const key = String(identifier || 'unknown');
    const now = Date.now();
    const record = attempts.get(key);
    if (!record || now - record.first > WINDOW_MS) {
        attempts.set(key, { count: 1, first: now });
        return;
    }
    record.count += 1;
}

export function clearLoginFailures(identifier) {
    attempts.delete(String(identifier || 'unknown'));
}
