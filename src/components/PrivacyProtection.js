'use client';

import { useEffect } from 'react';

function isProtectedMedia(target) {
    if (!target?.closest) return false;
    return Boolean(target.closest('img, video, .profile-photo, .protected-media, [data-protected-media="true"]'));
}

export default function PrivacyProtection() {
    useEffect(() => {
        /* ── 1. Mark all media as protected ── */
        const protectMedia = () => {
            document.querySelectorAll('img, video').forEach((node) => {
                node.setAttribute('draggable', 'false');
                node.setAttribute('controlsList', 'nodownload noplaybackrate nofullscreen');
                node.setAttribute('disablePictureInPicture', '');
                node.classList.add('protected-media');
                // Prevent long-press save on iOS/Android
                node.style.webkitTouchCallout = 'none';
                node.style.webkitUserSelect = 'none';
                node.style.userSelect = 'none';
                node.style.pointerEvents = 'auto';
            });
        };

        /* ── 2. Block right-click + drag on protected media ── */
        const preventIfProtected = (event) => {
            if (!isProtectedMedia(event.target)) return;
            event.preventDefault();
            event.stopPropagation();
            return false;
        };

        /* ── 3. Block ALL context menus app-wide ── */
        const preventContextMenu = (event) => {
            event.preventDefault();
            return false;
        };

        /* ── 4. Block keyboard shortcuts for screenshots/save/print/devtools ── */
        const preventKeyboard = (event) => {
            // PrintScreen
            if (event.key === 'PrintScreen') {
                event.preventDefault();
                navigator.clipboard?.writeText('Profile media is protected by Genuine Sugar Mummies privacy controls.').catch(() => {});
                return false;
            }
            // Ctrl+S / Cmd+S (save page)
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                return false;
            }
            // Ctrl+P / Cmd+P (print)
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
                event.preventDefault();
                return false;
            }
            // Ctrl+Shift+I / Cmd+Option+I (devtools)
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'i') {
                event.preventDefault();
                return false;
            }
            // Ctrl+U / Cmd+U (view source)
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'u') {
                event.preventDefault();
                return false;
            }
            // F12 (devtools)
            if (event.key === 'F12') {
                event.preventDefault();
                return false;
            }
        };

        /* ── 5. Block pinch-to-zoom on entire app ── */
        const preventPinchZoom = (event) => {
            if (event.touches?.length > 1) {
                event.preventDefault();
            }
        };

        /* ── 6. Block double-tap zoom ── */
        let lastTouchEnd = 0;
        const preventDoubleTapZoom = (event) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        };

        /* ── 7. Screen capture / screen recording detection ── */
        const handleVisibilityChange = () => {
            // When the app is backgrounded (possible screen recording switch), we can't
            // block it, but we can overlay a privacy shield on return
        };

        /* ── 8. Block drag-and-drop of images ── */
        const preventDragStart = (event) => {
            if (event.target?.tagName === 'IMG' || event.target?.tagName === 'VIDEO') {
                event.preventDefault();
                return false;
            }
        };

        /* ── 9. Block copy events ── */
        const preventCopy = (event) => {
            if (isProtectedMedia(event.target)) {
                event.preventDefault();
                return false;
            }
        };

        /* ── 10. CSS-level protections ── */
        const styleEl = document.createElement('style');
        styleEl.id = 'gs-privacy-styles';
        styleEl.textContent = `
            /* Prevent all image saving/selection */
            img, video, .protected-media {
                -webkit-touch-callout: none !important;
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
                pointer-events: auto !important;
                -webkit-user-drag: none !important;
            }

            /* Prevent text selection on profile cards */
            .profile-card, .member-card, [data-protected-media="true"] {
                -webkit-touch-callout: none !important;
                -webkit-user-select: none !important;
                user-select: none !important;
            }

            /* Prevent zoom on the entire app */
            html {
                touch-action: manipulation !important;
            }

            /* Block print */
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
        if (!document.getElementById('gs-privacy-styles')) {
            document.head.appendChild(styleEl);
        }

        /* ── Initialize ── */
        protectMedia();
        const observer = new MutationObserver(protectMedia);
        observer.observe(document.body, { childList: true, subtree: true });

        /* ── Attach listeners ── */
        document.addEventListener('contextmenu', preventContextMenu, { capture: true });
        document.addEventListener('dragstart', preventDragStart, { capture: true });
        document.addEventListener('copy', preventCopy);
        document.addEventListener('touchmove', preventPinchZoom, { passive: false });
        document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
        window.addEventListener('keydown', preventKeyboard, { capture: true });
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            observer.disconnect();
            document.removeEventListener('contextmenu', preventContextMenu, { capture: true });
            document.removeEventListener('dragstart', preventDragStart, { capture: true });
            document.removeEventListener('copy', preventCopy);
            document.removeEventListener('touchmove', preventPinchZoom);
            document.removeEventListener('touchend', preventDoubleTapZoom);
            window.removeEventListener('keydown', preventKeyboard, { capture: true });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            const el = document.getElementById('gs-privacy-styles');
            if (el) el.remove();
        };
    }, []);

    return null;
}
