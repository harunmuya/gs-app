'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import InAppNotification, { showNotification } from '@/components/InAppNotification';
import PromoPopup from '@/components/PromoPopup';

// Expose showNotification globally so AuthContext realtime hooks can trigger toasts
if (typeof window !== 'undefined') {
    window.__gsShowNotification = showNotification;
}

export default function ClientProviders({ children }) {
    const { user, campaigns, subscription } = useAuth();
    const [showPromo, setShowPromo] = useState(false);
    const isFreeUser = !subscription || subscription.plan === 'free';

    // Show promo popup for free users after a delay when intercomPromo is enabled
    useEffect(() => {
        if (!user || !isFreeUser || !campaigns?.intercomPromo) return;

        const delay = (campaigns.promoPopupDelay || 30) * 1000;
        const promoTimer = setTimeout(() => {
            // Only show if not dismissed recently
            const lastDismissed = sessionStorage.getItem('gs_promo_dismissed');
            if (!lastDismissed) {
                setShowPromo(true);
            }
        }, delay);

        return () => clearTimeout(promoTimer);
    }, [user?.id, isFreeUser, campaigns?.intercomPromo, campaigns?.promoPopupDelay]);

    // Also show promo on bannerAds if user navigates after 45 seconds
    useEffect(() => {
        if (!user || !isFreeUser || !campaigns?.bannerAds) return;

        const bannerTimer = setTimeout(() => {
            const lastDismissed = sessionStorage.getItem('gs_promo_dismissed');
            const count = parseInt(sessionStorage.getItem('gs_promo_count') || '0');
            if (!lastDismissed && count < 2) {
                setShowPromo(true);
            }
        }, 45000);

        return () => clearTimeout(bannerTimer);
    }, [user?.id, isFreeUser, campaigns?.bannerAds]);

    const handlePromoClose = () => {
        setShowPromo(false);
        sessionStorage.setItem('gs_promo_dismissed', Date.now().toString());
        const count = parseInt(sessionStorage.getItem('gs_promo_count') || '0');
        sessionStorage.setItem('gs_promo_count', String(count + 1));
    };

    return (
        <>
            {children}
            {/* Global in-app toast notifications */}
            <InAppNotification />
            {/* VIP Promo popup for free users */}
            <PromoPopup isOpen={showPromo} onClose={handlePromoClose} />
        </>
    );
}
