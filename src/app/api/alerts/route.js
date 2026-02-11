import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { fetchProfiles } from '@/lib/wordpress';

export async function GET() {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ alerts: [] });
        }

        // 1. Get real matches
        const { data: matches } = await supabase
            .from('matches')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

        // 2. Simulate "Who Liked You" (fetch random profiles)
        // In a real app, this would query a 'likes' table where target_user_id = user.id
        const randomPage = Math.floor(Math.random() * 10) + 1;
        const { profiles } = await fetchProfiles(randomPage, 5);

        const notifications = [];

        // Add matches
        if (matches && matches.length > 0) {
            matches.forEach(match => {
                notifications.push({
                    id: `match-${match.id}`,
                    type: 'match',
                    title: 'New Match! 💖',
                    message: `You matched with ${match.profile_name}`,
                    image: match.profile_image,
                    time: match.created_at,
                    read: false,
                });
            });
        }

        // Add simulated "Likes"
        profiles.forEach((profile, index) => {
            // Only add if not already matched (simple check)
            if (!matches?.find(m => m.profile_wp_id === profile.wpId)) {
                notifications.push({
                    id: `like-${profile.wpId}`,
                    type: 'like',
                    title: 'New Like 💘',
                    message: `${profile.name} liked your profile`,
                    image: profile.imageUrl,
                    time: new Date(Date.now() - (index * 3600000)).toISOString(), // Spread over hours
                    read: false,
                });
            }
        });

        // Add simulated "Profile Views"
        const { profiles: viewProfiles } = await fetchProfiles(randomPage + 1, 3);
        viewProfiles.forEach((profile, index) => {
            notifications.push({
                id: `view-${profile.wpId}`,
                type: 'view',
                title: 'Profile View 👀',
                message: `${profile.name} viewed your profile`,
                image: profile.imageUrl,
                time: new Date(Date.now() - (index * 7200000)).toISOString(),
                read: true,
            });
        });

        // Sort by time
        notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

        return NextResponse.json({ alerts: notifications });
    } catch (error) {
        console.error('Alerts API error:', error);
        return NextResponse.json({ alerts: [] }, { status: 500 });
    }
}
