import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { accountRestrictionMessage, accountStatus, isAccountRestricted } from '@/lib/packageAccess';

/**
 * Server-side session layer.
 *
 * Every user-facing API route must derive identity from here. Identity must never
 * come from a request body, query string, or client-supplied header — those are
 * attacker-controlled. `getAuthUser()` calls `auth.getUser()`, which verifies the
 * JWT against the Supabase auth server rather than trusting the cookie contents.
 *
 * Use `createRouteClient()` by default so Row Level Security applies. Reach for
 * `createAdminClient()` only for operations that are genuinely privileged
 * (admin tooling, auth user provisioning) — it bypasses RLS entirely.
 */

/** Columns needed to make an authorization decision about the session user. */
export const SESSION_MEMBER_FIELDS =
    'id, auth_user_id, email, username, display_name, subscription_tier, package_expires_at, ' +
    'admin_approved, package_locked, is_banned, is_suspended, account_deleted_at, ' +
    'profile_label, member_category, looking_for, preference, latitude, longitude, location, city, country';

function publicConfig() {
    return {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    };
}

/**
 * RLS-respecting Supabase client bound to the caller's session cookies.
 * Queries run as the signed-in user, so database policies are enforced.
 */
export async function createRouteClient() {
    const { url, anonKey } = publicConfig();
    if (!url || !anonKey) return null;

    const cookieStore = await cookies();

    return createServerClient(url, anonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // Called from a Server Component, where cookies are read-only.
                    // Session refresh is handled by middleware, so this is safe to ignore.
                }
            },
        },
    });
}

/**
 * Service-role client. Bypasses RLS — only for privileged operations.
 * `reason` is required so every bypass is self-documenting at the call site.
 */
export function createAdminClient(reason) {
    if (!reason) {
        throw new Error('createAdminClient() requires a reason describing why RLS is being bypassed.');
    }
    const { url } = publicConfig();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !serviceRoleKey) return null;

    return createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

/**
 * The verified Supabase Auth user for this request, or null.
 * Verified against the auth server — a forged or expired cookie yields null.
 */
export async function getAuthUser() {
    const supabase = await createRouteClient();
    if (!supabase) return null;
    try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) return null;
        return data.user;
    } catch {
        return null;
    }
}

/**
 * Resolve the application `users` row for the signed-in auth user.
 *
 * Accounts created before the Supabase Auth cutover are linked by `auth_user_id`;
 * accounts whose primary key was already the auth id are matched on `id`. Both are
 * checked so the migration can proceed without a flag day.
 *
 * Returns null when there is no session or no matching application row.
 */
export async function getSessionMember({ fields = SESSION_MEMBER_FIELDS } = {}) {
    const authUser = await getAuthUser();
    if (!authUser?.id) return null;

    // The membership lookup itself is a privileged read: the row may be needed to
    // evaluate whether RLS should allow anything at all.
    const admin = createAdminClient('resolve session member row from verified auth user id');
    if (!admin) return null;

    const { data, error } = await admin
        .from('users')
        .select(fields)
        .or(`auth_user_id.eq.${authUser.id},id.eq.${authUser.id}`)
        .limit(1);

    if (!error && data?.length) {
        return { ...data[0], authUserId: authUser.id, authEmail: authUser.email || '' };
    }
    if (error) return null;

    // No profile row for a valid session. Repair it rather than reporting the
    // member as signed out.
    //
    // 145 accounts in this database are in exactly this state: authentication
    // succeeded during signup but the profile insert never completed, so every
    // subsequent request read as unauthenticated and the member was bounced back
    // to the login screen no matter how many times they signed in. Returning null
    // here is what made that a permanent loop rather than a one-off failure.
    //
    // Signup now provisions auth and profile together with rollback, so new gaps
    // should not appear — this recovers the existing ones and anything that slips
    // through later.
    return provisionMissingProfile(admin, authUser, fields);
}

/**
 * Create the minimal profile row for an authenticated user that has none.
 *
 * Deliberately minimal: enough to hold a session, with the completion modal
 * collecting the rest. Refuses for deleted accounts, so a deletion cannot be
 * undone simply by signing in again.
 */
async function provisionMissingProfile(admin, authUser, fields) {
    const email = String(authUser.email || '').trim().toLowerCase();
    if (!email) return null;

    try {
        // A row may exist under this email without the id linkage — link it
        // rather than creating a duplicate account.
        const { data: byEmail } = await admin
            .from('users')
            .select('id, account_deleted_at')
            .ilike('email', email)
            .maybeSingle();

        if (byEmail?.account_deleted_at) return null;

        if (byEmail?.id) {
            await admin.from('users')
                .update({ auth_user_id: authUser.id, updated_at: new Date().toISOString() })
                .eq('id', byEmail.id);
            const { data: linked } = await admin.from('users').select(fields).eq('id', byEmail.id).maybeSingle();
            return linked ? { ...linked, authUserId: authUser.id, authEmail: email } : null;
        }

        const displayName = String(
            authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0] || 'Member'
        ).slice(0, 60);

        const { data: created, error: insertError } = await admin
            .from('users')
            .insert({
                id: authUser.id,          // keeps users.id === auth.uid() so RLS applies
                auth_user_id: authUser.id,
                email,
                display_name: displayName,
                avatar_url: authUser.user_metadata?.avatar_url || '',
                subscription_tier: 'free',
                is_seed_profile: false,
                // Not listed publicly until the profile is actually completed.
                show_in_public: false,
            })
            .select(fields)
            .maybeSingle();

        if (insertError) {
            console.error('[authSession] could not provision profile for', authUser.id, insertError.message);
            return null;
        }

        console.warn('[authSession] provisioned missing profile row for', authUser.id);
        return created ? { ...created, authUserId: authUser.id, authEmail: email } : null;
    } catch (err) {
        console.error('[authSession] provisionMissingProfile threw:', err?.message);
        return null;
    }
}

/**
 * Sign in and write the session cookies onto this response.
 * Must be called from a Route Handler — cookies are read-only elsewhere.
 */
export async function signInWithPassword(email, password) {
    const supabase = await createRouteClient();
    if (!supabase) return { data: null, error: new Error('Auth is not configured.') };
    return supabase.auth.signInWithPassword({
        email: String(email || '').trim().toLowerCase(),
        password: String(password || ''),
    });
}

export async function signOut() {
    const supabase = await createRouteClient();
    if (!supabase) return;
    try {
        await supabase.auth.signOut();
    } catch {
        // Already signed out, or cookies unavailable.
    }
}

/**
 * Create the Supabase Auth identity for an account that predates the cutover.
 *
 * Called only after the legacy scrypt hash has already been verified, so the
 * password is known-good and can be carried across without asking the member to
 * reset it. Returns the auth user, or an error.
 */
export async function provisionAuthUser(email, password, metadata = {}) {
    const admin = createAdminClient('provision Supabase Auth identity during legacy password migration');
    if (!admin) return { user: null, error: new Error('Auth provisioning is not configured.') };

    const cleanEmail = String(email || '').trim().toLowerCase();

    const created = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: String(password || ''),
        email_confirm: true, // The address was already in use on the legacy system.
        user_metadata: metadata,
    });

    if (!created.error) return { user: created.data?.user || null, error: null };

    // A concurrent request may have created it first, or an orphaned auth user
    // may already exist for this address.
    const existing = await findAuthUserByEmail(admin, cleanEmail);
    if (existing) {
        // Align the auth password with the verified legacy one so the sign-in below succeeds.
        await admin.auth.admin.updateUserById(existing.id, { password: String(password || '') }).catch(() => {});
        return { user: existing, error: null };
    }

    return { user: null, error: created.error };
}

/**
 * Look up an auth user by email.
 *
 * `listUsers` has no server-side email filter, so this pages through results.
 * Callers should treat it as a fallback, not a hot path.
 */
export async function findAuthUserByEmail(adminClient, email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !adminClient) return null;
    try {
        for (let page = 1; page <= 20; page++) {
            const result = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
            if (result.error) return null;
            const users = result.data?.users || [];
            const found = users.find((user) => String(user.email || '').trim().toLowerCase() === cleanEmail);
            if (found) return found;
            if (users.length < 1000) break;
        }
    } catch {
        // fall through
    }
    return null;
}

export function unauthorized(message = 'Sign in to continue.') {
    return NextResponse.json({ error: message, code: 'UNAUTHENTICATED' }, { status: 401 });
}

export function forbidden(message, code = 'ACCOUNT_RESTRICTED', extra = {}) {
    return NextResponse.json({ error: message, code, ...extra }, { status: 403 });
}

/**
 * Gate for routes that require a usable signed-in account.
 *
 * Returns `{ member }` on success, or `{ response }` holding the error to return.
 * Banned, suspended, and deleted accounts are rejected here so individual routes
 * do not each have to remember to check.
 *
 *   const { member, response } = await requireMember();
 *   if (response) return response;
 */
export async function requireMember(options = {}) {
    const member = await getSessionMember(options);
    if (!member) return { member: null, response: unauthorized() };

    if (isAccountRestricted(member)) {
        return {
            member: null,
            response: forbidden(
                accountRestrictionMessage(member) || 'Your account cannot be used right now.',
                'ACCOUNT_RESTRICTED',
                { accountStatus: accountStatus(member) }
            ),
        };
    }

    return { member, response: null };
}

/**
 * True when `targetId` is the signed-in member. Use before any write that names
 * a user id, so a client cannot substitute someone else's.
 */
export function ownsRecord(member, targetId) {
    if (!member?.id || !targetId) return false;
    return String(member.id) === String(targetId);
}
