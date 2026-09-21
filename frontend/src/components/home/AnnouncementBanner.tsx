/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Megaphone, X, ExternalLink, Flame, ChevronRight } from 'lucide-react';

export interface PublicAnnouncement {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  priority: 'Normal' | 'Urgent';
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export const AnnouncementBanner: React.FC = () => {
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState<PublicAnnouncement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPublicAnnouncements() {
      try {
        const res = await fetch('/api/announcements');
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          if (isMounted) {
            setAnnouncements(json.data);
            // Check if user dismissed this specific announcement in this session
            const top = json.data[0];
            const dismissedId = sessionStorage.getItem('nexus_dismissed_announcement');
            if (dismissedId === top.id) {
              setIsDismissed(true);
            }
            setActiveAnnouncement(top);
          }
        }
      } catch {
        // Silently fail if API is offline
      }
    }

    loadPublicAnnouncements();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismiss = () => {
    if (activeAnnouncement) {
      sessionStorage.setItem('nexus_dismissed_announcement', activeAnnouncement.id);
    }
    setIsDismissed(true);
  };

  if (!activeAnnouncement || isDismissed) {
    return null;
  }

  const isUrgent = activeAnnouncement.priority === 'Urgent';

  return (
    <>
      {/* Slim Top Bulletin Bar */}
      <aside
        aria-label="Public Bulletin"
        className={`w-full relative z-30 transition-all border-b ${
          isUrgent
            ? 'bg-red-950/80 border-red-800/60 text-red-100'
            : 'bg-neutral-900/90 border-neutral-800 text-neutral-200'
        } backdrop-blur-md`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 overflow-hidden flex-1">
            <span className="relative flex h-2 w-2 shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isUrgent ? 'bg-red-400' : 'bg-orange-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isUrgent ? 'bg-red-500' : 'bg-orange-500'
                }`}
              />
            </span>

            {isUrgent && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-red-600 text-white shrink-0 tracking-wider">
                <Flame className="w-2.5 h-2.5" />
                URGENT
              </span>
            )}

            <div className="flex items-center gap-2 truncate text-neutral-300">
              <span className="font-semibold text-white truncate">{activeAnnouncement.title}</span>
              <span className="hidden sm:inline text-neutral-500">•</span>
              <span className="hidden sm:inline text-neutral-400 truncate">{activeAnnouncement.summary}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
            >
              <span>Details</span>
              <ChevronRight className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss announcement"
              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Full Bulletin Detail Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  NEXUS OFFICIAL BULLETIN
                </span>
                {isUrgent && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950 text-red-400 border border-red-800/60">
                    URGENT
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-white tracking-tight">{activeAnnouncement.title}</h2>

              {activeAnnouncement.publishedAt && (
                <div className="text-[11px] font-mono text-neutral-500">
                  Published: {new Date(activeAnnouncement.publishedAt).toLocaleDateString()}
                  {activeAnnouncement.expiresAt && (
                    <span className="ml-3">
                      Expires: {new Date(activeAnnouncement.expiresAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-line">
                {activeAnnouncement.body || activeAnnouncement.summary}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between text-xs">
              <span className="text-[11px] font-mono text-neutral-500">
                NEXUS Community Broadcast
              </span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-1.5 rounded-lg font-medium bg-neutral-800 hover:bg-neutral-700 text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
