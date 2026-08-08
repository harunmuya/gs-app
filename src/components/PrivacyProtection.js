'use client';

import { useEffect } from 'react';

function isProtectedMedia(target) {
    if (!target?.closest) return false;
    return Boolean(target.closest('img, video, .profile-photo, .protected-media, [data-protected-media="true"]'));
}

export default function PrivacyProtection() {
    useEffect(() => {
        const protectMedia = () => {
            document.querySelectorAll('img, video').forEach((node) => {
                node.setAttribute('draggable', 'false');
                node.setAttribute('controlsList', 'nodownload noplaybackrate nofullscreen');
                node.setAttribute('disablePictureInPicture', '');
                node.classList.add('protected-media');
                node.style.webkitTouchCallout = 'none';
                node.style.webkitUserSelect = 'none';
                node.style.userSelect = 'none';
                node.style.pointerEvents = 'auto';
            });
        };

        const preventContextMenu = (event) => {
            event.preventDefault();
            return false;
        };

        const preventKeyboard = (event) => {
            if (event.key === 'PrintScreen') {
                event.preventDefault();
                navigator.clipboard?.writeText('Profile media is protected by Genuine Sugar Mummies privacy controls.').catch(() => {});
                return false;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                return false;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
                event.preventDefault();
                return false;
            }
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'i') {
                event.preventDefault();
                return false;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'u') {
                event.preventDefault();
                return false;
            }
            if (event.key === 'F12') {
                event.preventDefault();
                return false;
            }
        };

        const preventPinchZoom = (event) => {
            if (event.touches?.length > 1) event.preventDefault();
        };

        let lastTouchEnd = 0;
        const preventDoubleTapZoom = (event) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) event.preventDefault();
            lastTouchEnd = now;
        };

        const preventDragStart = (event) => {
            if (event.target?.tagName === 'IMG' || event.target?.tagName === 'VIDEO') {
                event.preventDefault();
                return false;
            }
        };

        const preventCopy = (event) => {
            if (isProtectedMedia(event.target)) {
                event.preventDefault();
                return false;
            }
        };

        const styleEl = document.createElement('style');
        styleEl.id = 'gs-privacy-styles';
        styleEl.textContent = `
            img, video, .protected-media {
                -webkit-touch-callout: none !important;
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
                pointer-events: auto !important;
                -webkit-user-drag: none !important;
            }

            .profile-card, .member-card, [data-protected-media="true"] {
                -webkit-touch-callout: none !important;
                -webkit-user-select: none !important;
                user-select: none !important;
            }

            html {
                touch-action: manipulation !important;
            }

            @media print {
                body * { display: none !important; }
                body::after {
                    content: 'Printing is disabled for privacy protection.';
                    display: block;
                    text-align: center;
                    padding: 40px;
                    font-size: 18px;
                    color: #666;
                }
            }
        `;
        if (!document.getElementById('gs-privacy-styles')) document.head.appendChild(styleEl);

        protectMedia();
        const observer = new MutationObserver(protectMedia);
        observer.observe(document.body, { childList: true, subtree: true });

        document.addEventListener('contextmenu', preventContextMenu, { capture: true });
        document.addEventListener('dragstart', preventDragStart, { capture: true });
        document.addEventListener('copy', preventCopy);
        document.addEventListener('touchmove', preventPinchZoom, { passive: false });
        document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
        window.addEventListener('keydown', preventKeyboard, { capture: true });

        return () => {
            observer.disconnect();
            document.removeEventListener('contextmenu', preventContextMenu, { capture: true });
            document.removeEventListener('dragstart', preventDragStart, { capture: true });
            document.removeEventListener('copy', preventCopy);
            document.removeEventListener('touchmove', preventPinchZoom);
            document.removeEventListener('touchend', preventDoubleTapZoom);
            window.removeEventListener('keydown', preventKeyboard, { capture: true });
            const el = document.getElementById('gs-privacy-styles');
            if (el) el.remove();
        };
    }, []);

    return null;
}
