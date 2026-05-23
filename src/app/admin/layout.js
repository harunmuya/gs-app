'use client';

import { useEffect } from 'react';

export default function AdminLayout({ children }) {
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.body.classList.add('admin-body');
        }
        return () => {
            if (typeof document !== 'undefined') {
                document.body.classList.remove('admin-body');
            }
        };
    }, []);

    return (
        <div className="relative min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-rose-500 selection:text-white flex flex-col">
            {children}
        </div>
    );
}
