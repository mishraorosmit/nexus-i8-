/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { NexusIcon } from '../brand/NexusLogo.tsx';
import { GalleryItem } from '../../types.ts';
import { handleImageFallbackError, getLocalFallbackUrl } from '../../data/cloudinaryMap.ts';

interface GalleryTileProps {
  item: GalleryItem;
  aspectRatio?: '16/9' | '4/3' | '1/1' | '3/2' | '21/9' | 'portrait' | 'auto';
  onSelect?: (item: GalleryItem) => void;
  className?: string;
}

/**
 * GalleryTile
 * Interactive editorial gallery tile maintaining authentic masonry rhythm.
 *
 * Hover specifications:
 * - Image expands slightly (1 -> 1.03) inside clean overflow-hidden boundary
 * - Caption appears/strengthens with clean contrast
 * - Small arrow appears with smooth translation
 * - Subtle border accent and elevation
 * - Keyboard accessible with tabIndex and visible focus ring
 */
export const GalleryTile: React.FC<GalleryTileProps> = ({
  item,
  aspectRatio = item.aspectRatio || '16/9',
  onSelect,
  className = '',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Synchronize state for cached images that completed before event listener registration
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [item.imageUrl]);

  const aspectClass = {
    '16/9': 'aspect-[16/9]',
    '4/3': 'aspect-[4/3]',
    '1/1': 'aspect-square',
    '3/2': 'aspect-[3/2]',
    '21/9': 'aspect-[21/9]',
    'portrait': 'aspect-[3/4]',
    'auto': '',
  }[aspectRatio];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(item);
    }
  };

  return (
    <figure
      data-cursor="gallery"
      tabIndex={0}
      role={onSelect ? 'button' : 'figure'}
      aria-label={`${item.title} — ${item.category}`}
      onClick={() => onSelect?.(item)}
      onKeyDown={handleKeyDown}
      className={`
        group relative flex flex-col w-full
        bg-[var(--bg-surface)] border border-[var(--border-subtle)]
        transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]
        hover:border-[#F2613F]/60 hover:bg-[var(--bg-elevated)] hover:shadow-xs
        active:scale-[0.99]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2613F] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]
        cursor-pointer select-none
        ${className}
      `}
    >
      {/* Image container with overflow-hidden and shimmer placeholder */}
      <div
        className={`relative w-full overflow-hidden bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] ${aspectClass}`}
      >
        {/* Shimmer loading skeleton placeholder */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-secondary)] via-[var(--bg-surface)] to-[var(--bg-secondary)] animate-pulse" />
        )}

        {/* Visual surface scaling 1 -> 1.03 on hover */}
        <div className="w-full h-full flex flex-col items-center justify-center text-center transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]">
          {item.imageUrl && !hasError ? (
            <img
              ref={imgRef}
              src={item.imageUrl}
              alt={item.title}
              onLoad={() => setIsLoaded(true)}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.fallbackTried === 'true') {
                  setHasError(true);
                  setIsLoaded(true);
                  return;
                }
                const currentSrc = img.currentSrc || img.src;
                const fallback = getLocalFallbackUrl(currentSrc);
                if (fallback && fallback !== currentSrc && !currentSrc.endsWith(fallback)) {
                  img.dataset.fallbackTried = 'true';
                  img.src = fallback;
                } else {
                  img.dataset.fallbackTried = 'true';
                  setHasError(true);
                  setIsLoaded(true);
                }
              }}
              className={`w-full h-full object-cover filter grayscale contrast-[1.05] group-hover:grayscale-0 group-hover:contrast-100 transition-all duration-500 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[var(--bg-secondary)]">
              {/* Subtle background grid */}
              <div
                className="absolute inset-0 opacity-30 bg-[radial-gradient(var(--text-primary)_1px,transparent_1px)] [background-size:14px_14px] pointer-events-none"
                aria-hidden="true"
              />

              <div className="relative z-10 flex flex-col items-center">
                <NexusIcon
                  size="lg"
                  className="mb-3 opacity-65 group-hover:opacity-100 transition-opacity transform group-hover:scale-105 duration-300"
                />
                <span className="font-dosis text-[10px] font-bold tracking-[0.22em] uppercase px-2.5 py-0.5 border border-[var(--border-subtle)] text-[var(--text-primary)] bg-[var(--bg-surface)]/80">
                  PHOTO // {item.category}
                </span>
                <span className="mt-2 font-bitter text-xs text-[var(--text-primary)] font-bold max-w-[220px] line-clamp-1">
                  {item.title}
                </span>
              </div>
            </div>
          )}

          {/* Framing corners */}
          <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[var(--text-primary)]/30 pointer-events-none" />
          <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[var(--text-primary)]/30 pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-[var(--text-primary)]/30 pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-[var(--text-primary)]/30 pointer-events-none" />
        </div>

        {/* Date and category tag pill */}
        <div className="absolute top-3 left-3 px-2 py-0.5 bg-[var(--bg-primary)] text-[var(--text-primary)] text-[10px] font-dosis font-bold tracking-[0.16em] uppercase border border-[rgba(242,97,63,0.4)]">
          {item.eventDate}
        </div>

        {/* Small arrow icon indicator (appears and translates on hover) */}
        <div className="absolute top-3 right-3 p-1.5 bg-[var(--bg-primary)] text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform translate-y-1 group-hover:translate-y-0 group-hover:translate-x-0.5">
          <ArrowUpRight className="w-3.5 h-3.5 text-[#F2613F]" />
        </div>
      </div>

      {/* Caption & Metadata bar */}
      <figcaption className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-dosis text-[11px] font-bold tracking-[0.2em] text-[#F2613F] uppercase">
            {item.category}
          </span>
          <span className="font-dosis text-[10px] font-semibold tracking-[0.16em] text-[var(--text-muted)]">
            STUDIO RECORD
          </span>
        </div>

        {/* Caption text appears / sharpens on hover */}
        <p className="font-bitter text-xs sm:text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors duration-300 leading-relaxed">
          {item.caption}
        </p>

        {/* Small orange accent rule on hover */}
        <div
          className="w-0 h-[1.5px] bg-[#F2613F] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-10"
          aria-hidden="true"
        />
      </figcaption>
    </figure>
  );
};
