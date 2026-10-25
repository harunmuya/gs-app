import { apiError, apiOk, ERROR_CODES } from '@/lib/apiContract';
import { createServerSupabaseClient, getServerSupabaseConfig } from '@/lib/supabaseAdmin';
import { adminAuthConfigured } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

export async function GET() {
    const config = getServerSupabaseConfig();
    const checks = {
        env: {
            supabaseUrl: Boolean(config.url),
            anonKey: Boolean(config.anonKey),
            serviceRoleKey: Boolean(config.serviceRoleKey),
            /*
              Whether admin login can work at all on this deployment.

              Admin sign-in needs ADMIN_EMAIL, a password hash and a session
              signing secret. When one is missing the login endpoint answers
              503, which from the admin screen is indistinguishable from the
              server being down — so "admin is broken" had no way to be told
              apart from "admin was never configured here".

              This is a presence check only. No value is read back, and it
              reports no more than the Supabase lines above already do.
            */
            adminAuth: adminAuthConfigured(),
        },
        database: {
            reachable: false,
            usersReadable: false,
            packagesReadable: false,
        },
    };

    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) {
        return apiError(ERROR_CODES.SERVER_MISCONFIGURED, 'Supabase server configuration is missing.', 503, { checks });
    }

    try {
        const [users, packages] = await Promise.all([
            supabase.from('users').select('id', { count: 'exact', head: true }),
            supabase.from('package_tiers').select('id', { count: 'exact', head: true }),
        ]);
        checks.database.reachable = true;
        checks.database.usersReadable = !users.error;
        checks.database.packagesReadable = !packages.error;
        const healthy = checks.database.usersReadable && checks.database.packagesReadable;
        return apiOk({ healthy, checks }, { status: healthy ? 200 : 503 });
    } catch (error) {
        return apiError(ERROR_CODES.SERVER_ERROR, 'Health check failed.', 503, {
            checks,
            detail: error?.message || 'Unknown error',
        });
    }
}

