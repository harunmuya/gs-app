'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useGeolocation() {
    const [location, setLocation] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const { user, supabase } = useAuth();

    const requestLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            return;
        }

        setLoading(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const coords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                setLocation(coords);
                setLoading(false);

                // Save to database if user is logged in
                if (user && supabase) {
                    try {
                        await supabase.from('user_locations').upsert({
                            user_id: user.id,
                            latitude: coords.latitude,
                            longitude: coords.longitude,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'user_id' });
                    } catch (err) {
                        console.error('Failed to save location:', err);
                    }
                }
            },
            (err) => {
                setError(err.message);
                setLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000, // 5 min cache
            }
        );
    }, [user, supabase]);

    // Load saved location from DB on mount
    useEffect(() => {
        async function loadSavedLocation() {
            if (user && supabase) {
                try {
                    const { data } = await supabase
                        .from('user_locations')
                        .select('*')
                        .eq('user_id', user.id)
                        .single();
                    if (data) {
                        setLocation({ latitude: data.latitude, longitude: data.longitude });
                    }
                } catch (err) {
                    // No saved location
                }
            }
        }
        loadSavedLocation();
    }, [user, supabase]);

    return { location, error, loading, requestLocation };
}
