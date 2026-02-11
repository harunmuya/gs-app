'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const getSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setUser(session?.user ?? null);
                if (session?.user) {
                    await fetchProfile(session.user.id);
                }
            } catch (error) {
                console.error('Session error:', error);
            } finally {
                setLoading(false);
            }
        };

        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setUser(session?.user ?? null);
                if (session?.user) {
                    await fetchProfile(session.user.id);
                } else {
                    setProfile(null);
                }
                setLoading(false);
            }
        );

        return () => subscription?.unsubscribe();
    }, []);

    async function fetchProfile(userId) {
        try {
            const { data } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
            setProfile(data);
        } catch (error) {
            console.error('Profile fetch error:', error);
        }
    }

    async function signUp(email, password, displayName) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: displayName },
            },
        });
        if (error) throw error;
        return data;
    }

    async function signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    }

    async function signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) throw error;
        return data;
    }

    async function signInWithOTP(phone) {
        const { data, error } = await supabase.auth.signInWithOtp({
            phone,
        });
        if (error) throw error;
        return data;
    }

    async function verifyOTP(phone, token) {
        const { data, error } = await supabase.auth.verifyOtp({
            phone,
            token,
            type: 'sms',
        });
        if (error) throw error;
        return data;
    }

    async function signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setUser(null);
        setProfile(null);
    }

    async function updateProfile(updates) {
        if (!user) return;
        const { data, error } = await supabase
            .from('users')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select()
            .single();
        if (error) throw error;
        setProfile(data);
        return data;
    }

    async function deleteAccount() {
        if (!user) return;
        // Delete user data
        await supabase.from('matches').delete().eq('user_id', user.id);
        await supabase.from('likes').delete().eq('user_id', user.id);
        await supabase.from('passes').delete().eq('user_id', user.id);
        await supabase.from('preferences').delete().eq('user_id', user.id);
        await supabase.from('user_locations').delete().eq('user_id', user.id);
        await supabase.from('users').delete().eq('id', user.id);
        await signOut();
    }

    const [guest, setGuest] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const isGuest = localStorage.getItem('guest_mode') === 'true';
            if (isGuest) setGuest(true);
        }
    }, []);

    function skipLogin() {
        setGuest(true);
        if (typeof window !== 'undefined') {
            localStorage.setItem('guest_mode', 'true');
        }
    }

    const value = {
        user,
        guest,
        profile,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithOTP,
        skipLogin,
        verifyOTP,
        signOut,
        updateProfile,
        deleteAccount,
        supabase,
        refreshProfile: () => user && fetchProfile(user.id),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
