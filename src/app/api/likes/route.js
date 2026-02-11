import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { calculateMatchScore } from '@/lib/matching';

export async function POST(request) {
    try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { profileWpId, profileName, profileImage, profileLocation, profileBio, profileCoords } = body;

        if (!profileWpId) {
            return NextResponse.json({ error: 'Missing profileWpId' }, { status: 400 });
        }

        // Prevent duplicate likes
        const { data: existing } = await supabase
            .from('likes')
            .select('id')
            .eq('user_id', user.id)
            .eq('profile_wp_id', profileWpId)
            .single();

        if (existing) {
            return NextResponse.json({ message: 'Already liked', duplicate: true });
        }

        // Record the like
        const { error: likeError } = await supabase.from('likes').insert({
            user_id: user.id,
            profile_wp_id: profileWpId,
            profile_name: profileName,
            profile_image: profileImage,
            profile_location: profileLocation,
        });

        if (likeError) throw likeError;

        // Get user location for scoring
        let userCoords = null;
        const { data: locData } = await supabase
            .from('user_locations')
            .select('latitude, longitude')
            .eq('user_id', user.id)
            .single();

        if (locData) {
            userCoords = { lat: locData.latitude, lng: locData.longitude };
        }

        // Calculate match score
        const score = calculateMatchScore(userCoords, profileCoords);

        // Create match (every like creates a match with a score)
        const { error: matchError } = await supabase.from('matches').upsert({
            user_id: user.id,
            profile_wp_id: profileWpId,
            profile_name: profileName,
            profile_image: profileImage,
            profile_location: profileLocation,
            profile_bio: profileBio,
            score,
        }, { onConflict: 'user_id,profile_wp_id' });

        if (matchError) console.error('Match error:', matchError);

        return NextResponse.json({
            success: true,
            score,
            isMatch: score >= 50,
        });
    } catch (error) {
        console.error('Like API error:', error);
        return NextResponse.json(
            { error: 'Failed to record like' },
            { status: 500 }
        );
    }
}
