'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';

/**
 * ImageLightbox — Full-screen image viewer with zoom and gestures.
 * @param {string} src - Image URL to display
 * @param {string} alt - Alt text
 * @param {boolean} isOpen - Whether lightbox is open
 * @param {function} onClose - Close handler
 */
export default function ImageLightbox({ src, alt = '', isOpen, onClose }) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const posStart = useRef({ x: 0, y: 0 });
    const lastTap = useRef(0);
    const containerRef = useRef(null);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setScale(1);
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen]);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [isOpen]);

    // Keyboard support
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.5, 5));
            if (e.key === '-') setScale(s => Math.max(s - 0.5, 1));
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    const handleDoubleTap = (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastTap.current < 300) {
            // Double tap: toggle zoom
            if (scale > 1) {
                setScale(1);
                setPosition({ x: 0, y: 0 });
            } else {
                setScale(2.5);
            }
        }
        lastTap.current = now;
    };

    const handleTouchStart = (e) => {
        if (scale <= 1) return;
        if (e.touches.length === 1) {
            setIsDragging(true);
            dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            posStart.current = { ...position };
        }
    };

    const handleTouchMove = (e) => {
        if (!isDragging || scale <= 1) return;
        e.preventDefault();
        const dx = e.touches[0].clientX - dragStart.current.x;
        const dy = e.touches[0].clientY - dragStart.current.y;
        setPosition({
            x: posStart.current.x + dx,
            y: posStart.current.y + dy,
        });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        // If not zoomed and dragged down, close
        if (scale <= 1 && Math.abs(position.y) > 100) {
            onClose();
        }
    };

    const handleMouseDown = (e) => {
        if (scale <= 1) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        posStart.current = { ...position };
    };

    const handleMouseMove = (e) => {
        if (!isDragging || scale <= 1) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setPosition({
            x: posStart.current.x + dx,
            y: posStart.current.y + dy,
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.3 : 0.3;
        setScale(s => {
            const next = Math.max(1, Math.min(5, s + delta));
            if (next <= 1) setPosition({ x: 0, y: 0 });
            return next;
        });
    };

    const handleBackdropClick = (e) => {
        if (e.target === containerRef.current) {
            onClose();
        }
    };

    if (!src) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={containerRef}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[300] flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(20px)' }}
                    onClick={handleBackdropClick}
                    onWheel={handleWheel}
                >
                    {/* Close button */}
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={onClose}
                        className="absolute top-[max(env(safe-area-inset-top,16px),16px)] right-4 z-10 p-2.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}
                    >
                        <X size={22} className="text-white" />
                    </motion.button>

                    {/* Zoom controls */}
                    <div className="absolute bottom-[max(env(safe-area-inset-bottom,20px),20px)] left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-2 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                        <button onClick={() => setScale(s => { const n = Math.max(1, s - 0.5); if (n <= 1) setPosition({ x: 0, y: 0 }); return n; })}
                            className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                            <ZoomOut size={18} className="text-white" />
                        </button>
                        <span className="text-xs text-white/70 font-medium min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(s => Math.min(5, s + 0.5))}
                            className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                            <ZoomIn size={18} className="text-white" />
                        </button>
                    </div>

                    {/* Image */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="max-w-full max-h-full select-none"
                        style={{
                            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                            transition: isDragging ? 'none' : 'transform 0.2s ease',
                        }}
                        onClick={handleDoubleTap}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <img
                            src={src}
                            alt={alt}
                            className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg"
                            referrerPolicy="no-referrer"
                            draggable={false}
                            style={{ imageRendering: 'auto' }}
                        />
                    </motion.div>

                    {/* Alt text / caption */}
                    {alt && (
                        <div className="absolute bottom-[max(calc(env(safe-area-inset-bottom,20px)+56px),76px)] left-1/2 -translate-x-1/2 z-10">
                            <span className="text-xs text-white/50 font-medium">{alt}</span>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
