import { apiOk, ANDROID_PERMISSION_MATRIX, API_ENDPOINTS, LEGAL_VERSIONS } from '@/lib/apiContract';
import { createServerSupabaseClient } from '@/lib/supabaseAdmin';
import { allDefaultPackageTiers } from '@/lib/packageAccess';

export const dynamic = 'force-dynamic';

async function packageRows() {
    const supabase = createServerSupabaseClient({ admin: true });
    if (!supabase) return allDefaultPackageTiers();
    try {
        const { data, error } = await supabase
            .from('package_tiers')
            .select('*')
            .eq('is_active', true)
            .in('id', ['free', 'basic', 'silver', 'gold'])
            .order('sort_order', { ascending: true });
        if (error || !data?.length) return allDefaultPackageTiers();
        return data;
    } catch {
        return allDefaultPackageTiers();
    }
}

function publicSiteUrl() {
    const value = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || '').trim();
    if (!value || /\.vercel\.app\b/i.test(value)) return '';
    return value.replace(/\/+$/, '');
}

export async function GET() {
    const packages = await packageRows();
    return apiOk({
        app: {
            name: 'Genuine Sugar Mummies Kenya',
            platform: 'android_web_shared',
            productionUrl: publicSiteUrl(),
            apiBase: '/api/v1',
        },
        legal: LEGAL_VERSIONS,
        permissions: ANDROID_PERMISSION_MATRIX,
        endpoints: API_ENDPOINTS,
        packages,
        featureFlags: {
            nativeAndroidPhaseARequired: true,
            webviewDependencyStillPresent: true,
            serverSideEntitlements: true,
            seededProfilesSeparated: true,
            profileCompletionRequiredForDiscovery: true,
        },
    }, {
        headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
    });
}
